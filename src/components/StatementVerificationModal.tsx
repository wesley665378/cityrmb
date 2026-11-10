import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, CheckCircle2, AlertTriangle, AlertCircle, FileText, X, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { verifyBankStatement, confirmStatementConflicts, BankStatementVerificationResult } from '../api/audit';

export interface StatementVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRefresh?: () => Promise<void>;
}

export const StatementVerificationModal: React.FC<StatementVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccessRefresh,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<BankStatementVerificationResult | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  // 下载标准模板功能
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          '收(付)方名称': '严琼',
          '借方金额': 319.21,
          '摘要': '转账-严琼交通费报销',
          '流水号': 'BNK20261024001',
          '业务摘要': '严琼交通费'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData, {
        header: ['收(付)方名称', '借方金额', '摘要', '流水号', '业务摘要']
      });

      worksheet['!cols'] = [
        { wch: 18 }, // 收(付)方名称
        { wch: 14 }, // 借方金额
        { wch: 28 }, // 摘要
        { wch: 22 }, // 流水号
        { wch: 22 }  // 业务摘要
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '流水校验');
      XLSX.writeFile(workbook, '流水校验标准模板.xlsx');
      toast.success('已生成并自动下载：流水校验标准模板.xlsx');
    } catch (err) {
      console.error('Download template error:', err);
      window.open('/api/finance/download-template', '_blank');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      // 校验文件表头格式（防呆）
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (rawRows.length > 0) {
        const sampleRowKeys = Object.keys(rawRows[0]).map(k => String(k).trim().replace(/\s+/g, ''));
        const hasPayeeHeader = sampleRowKeys.some(k => k.includes('收(付)方名称') || k.includes('收付方名称') || k.includes('对方户名') || k.includes('户名') || k.includes('名称') || k.includes('对方') || k.includes('收款') || k.includes('付款'));
        const hasAmountHeader = sampleRowKeys.some(k => k.includes('借方金额') || k.includes('金额') || k.includes('发生额') || k.includes('支出') || k.includes('收入'));
        const hasIdHeader = sampleRowKeys.some(k => k.includes('流水号') || k.includes('凭证号') || k.includes('单号') || k.includes('报文号'));

        if (!hasPayeeHeader || !hasAmountHeader || !hasIdHeader) {
          toast.error('模板格式错误，请下载最新的标准模板重试！');
          e.target.value = '';
          setFile(null);
          return;
        }
      } else {
        toast.error('模板格式错误，请下载最新的标准模板重试！');
        e.target.value = '';
        setFile(null);
        return;
      }

      setFile(selectedFile);
      await executeVerification(selectedFile);
    } catch (err: any) {
      console.error('Verification file check failed:', err);
      toast.error('模板格式错误，请下载最新的标准模板重试！');
      e.target.value = '';
      setFile(null);
    }
  };

  const executeVerification = async (targetFile?: File | null) => {
    setIsUploading(true);
    try {
      let base64Data: string | undefined = undefined;
      let filename: string | undefined = targetFile?.name;

      if (targetFile) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.includes(',') ? res.split(',')[1] : res;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(targetFile);
        });
      }

      const res = await verifyBankStatement(base64Data, filename);
      setResult(res);

      // Pre-select first candidate for conflicts if available
      const initialSelections: Record<string, string> = {};
      if (res.conflicts && res.conflicts.length > 0) {
        res.conflicts.forEach(c => {
          if (c.candidates && c.candidates.length > 0) {
            initialSelections[c.statementItem.id] = c.candidates[0].id;
          }
        });
      }
      setSelectedCandidates(initialSelections);

      toast.success('银行流水校验解析成功');
    } catch (err: any) {
      console.error('Verification failed:', err);
      toast.error(`流水校验失败: ${err?.message || '文件格式不合规'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmBatch = async () => {
    if (isConfirming) return;

    const confirmations: Array<{ logId: string; transactionId?: string }> = [];

    // 1. Add ALL auto-matched items
    if (result?.matched) {
      for (const m of result.matched) {
        if (m.matchedLog?.id) {
          confirmations.push({
            logId: m.matchedLog.id,
            transactionId: m.statementItem?.transactionId
          });
        }
      }
    }

    // 2. Add selected candidate items from conflict area
    if (result?.conflicts) {
      for (const conflict of result.conflicts) {
        const chosenLogId = selectedCandidates[conflict.statementItem.id];
        if (chosenLogId) {
          confirmations.push({
            logId: chosenLogId,
            transactionId: conflict.statementItem.transactionId
          });
        }
      }
    }

    if (confirmations.length === 0) {
      toast.error('暂无待处理的比对或勾选单据');
      return;
    }

    setIsConfirming(true);
    const toastId = toast.loading('正在提交批量确权更新…');

    try {
      await confirmStatementConflicts(confirmations);
      
      if (onSuccessRefresh) {
        await onSuccessRefresh();
      }

      toast.success(`批量确权更新成功！共处理 ${confirmations.length} 笔单据。`, { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error(`更新确权失败: ${err?.message || '系统繁忙'}`, { id: toastId });
    } finally {
      setIsConfirming(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              🏦
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                城市守护者 - 导入 + 流水校验
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                提取对方户名与流水号，自动与待确权消耗单据核对
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
          
          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 bg-slate-50/70 hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                上传付款流水 Excel 文件 (.xls / .xlsx)
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                支持标准网银导出的交易流水，后端自动抽取【对方户名】与【流水号】
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>下载标准模板 (.xlsx)</span>
              </button>

              <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>选择 Excel 文件上传</span>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => executeVerification(null)}
                disabled={isUploading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>加载示例流水测试</span>
              </button>
            </div>

            {file && (
              <div className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
                已选中文件: {file.name}
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {isUploading && (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500 animate-pulse">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-700">后端服务正在解析 Excel 及执行防跨年多路并发匹配…</span>
            </div>
          )}

          {/* Verification Results Panel */}
          {result && !isUploading && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Statistical Summary Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Matched */}
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-4 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-emerald-800 font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      校验通过（待确认批量确权）
                    </span>
                    <span className="text-lg font-black font-mono">{result.summary.matchedCount} 笔</span>
                  </div>
                  <p className="text-[10px] text-emerald-700/80 leading-tight">
                    户名精准命中唯一待确权消耗单据，确认后将批量写入交易流水号并完成确权
                  </p>
                </div>

                {/* 2. Conflict */}
                <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-amber-800 font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      户名冲突（需人工确认）
                    </span>
                    <span className="text-lg font-black font-mono">{result.summary.conflictCount} 笔</span>
                  </div>
                  <p className="text-[10px] text-amber-700/80 leading-tight">
                    匹配到多条候选待确权消耗单据，请在下方冲突处理区域勾选指定单据
                  </p>
                </div>

                {/* 3. Exception */}
                <div className="bg-rose-50/80 border border-rose-200/80 p-4 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-rose-800 font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      异常单据（查无此单）
                    </span>
                    <span className="text-lg font-black font-mono">{result.summary.exceptionCount} 笔</span>
                  </div>
                  <p className="text-[10px] text-rose-700/80 leading-tight">
                    在系统待确权列表中未搜索到对应记录，请人工核查是否重复或漏报
                  </p>
                </div>
              </div>

              {/* Matched Detail List Area (自动匹配成功明细区) */}
              {result.matched && result.matched.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      自动匹配成功明细 (共 {result.matched.length} 笔，提交时将一并批量确权)
                    </h4>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {result.matched.map((item, idx) => (
                      <div 
                        key={item.matchedLog?.id || idx}
                        className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-black">
                            匹配 #{idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-800">
                              系统单号: <span className="font-mono text-blue-600">#{item.matchedLog.id}</span>
                            </span>
                            <span className="text-slate-300 mx-2">|</span>
                            <span className="text-slate-600">
                              对方户名/支付对象: <strong className="text-slate-900">{item.statementItem.payeeName || item.matchedLog.payeeName || '-'}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 font-mono font-bold text-slate-700">
                          <span>数值: <span className="text-emerald-700">{Math.round(item.matchedLog.dynamicCost || item.statementItem.amount || 0).toLocaleString()}</span></span>
                          <span className="text-slate-400 text-[11px]">流水号: {item.statementItem.transactionId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflict Handling Area (冲突处理区域) */}
              {result.conflicts && result.conflicts.length > 0 && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      冲突处理区域（必须人工勾选候选单据）
                    </h4>
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
                      待确认 {result.conflicts.length} 笔
                    </span>
                  </div>

                  <div className="space-y-4">
                    {result.conflicts.map((conflict, idx) => (
                      <div 
                        key={conflict.statementItem.id || idx}
                        className="bg-amber-50/40 border border-amber-200/90 rounded-2xl p-4 space-y-3"
                      >
                        {/* Statement Information Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2 text-xs">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black">
                              冲突 #{idx + 1}
                            </span>
                            <span>对方户名: <strong className="text-blue-700">{conflict.statementItem.payeeName}</strong></span>
                          </div>
                          <div className="flex items-center gap-4 font-mono font-bold text-slate-700">
                            <span>数值: <span className="text-amber-800">{Math.round(conflict.statementItem.amount).toLocaleString()}</span></span>
                            <span>交易时间: <span className="text-slate-500">{conflict.statementItem.transactionTime}</span></span>
                            <span>流水号: <span className="text-slate-500">{conflict.statementItem.transactionId}</span></span>
                          </div>
                        </div>

                        {/* Candidate list options */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-600">
                            系统匹配到以下多条候选单据，请选择 1 笔关联合规确权：
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {conflict.candidates.map((candidate) => {
                              const isChecked = selectedCandidates[conflict.statementItem.id] === candidate.id;
                              return (
                                <label
                                  key={candidate.id}
                                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-white border-blue-600 ring-2 ring-blue-600/10 shadow-xs'
                                      : 'bg-white/80 border-slate-200 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="radio"
                                      name={`conflict-${conflict.statementItem.id}`}
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedCandidates(prev => ({
                                          ...prev,
                                          [conflict.statementItem.id]: candidate.id
                                        }));
                                      }}
                                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                    />
                                    <div>
                                      <div className="font-bold text-slate-800 flex items-center gap-2">
                                        <span>申报编号: <span className="font-mono text-blue-600">#{candidate.id}</span></span>
                                        <span className="text-slate-300">|</span>
                                        <span>业务日期: <span className="font-mono text-slate-600">{candidate.businessDate || candidate.month || '-'}</span></span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                        <span>分类: <span className="font-bold">{candidate.costCategory ? `${candidate.costCategory}类动态消耗` : candidate.type}</span></span>
                                        <span>矿山: <span className="font-mono font-bold text-slate-700">{candidate.miningId || '公摊无项目'}</span></span>
                                        <span>采集主体: <span className="font-bold">{candidate.recordedCollectorId || candidate.rankId}</span></span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right font-mono">
                                    <span className="text-xs font-black text-amber-800">
                                      数值: {Math.round(candidate.dynamicCost || candidate.amount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exception List */}
              {result.exceptions && result.exceptions.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    异常单据明细 (共 {result.exceptions.length} 笔)
                  </h4>
                  <div className="bg-rose-50/40 border border-rose-200/60 rounded-xl p-3 space-y-1 text-[11px]">
                    {result.exceptions.map((exc, i) => (
                      <div key={i} className="flex justify-between items-center text-rose-800 font-mono">
                        <span>对方户名: <strong>{exc.statementItem.payeeName}</strong> ({exc.statementItem.transactionTime})</span>
                        <span>数值: {Math.round(exc.statementItem.amount).toLocaleString()} ({exc.reason})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            关 闭
          </button>

          <button
            type="button"
            onClick={handleConfirmBatch}
            disabled={isConfirming || !result}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isConfirming ? (
              <span>处理中…</span>
            ) : (
              <span>确认并批量确权</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
