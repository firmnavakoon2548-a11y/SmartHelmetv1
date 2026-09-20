import React, { useState } from 'react';
import {
  Bluetooth,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Battery,
  Zap,
  HelpCircle,
  Smartphone,
  RefreshCw,
  Cpu,
  Volume2,
  Play,
  FileAudio
} from 'lucide-react';
import { ConnectionState, bleHelmetService } from '../services/bleHelmetService';
import {
  DFPLAYER_AUDIO_CATALOG,
  findDfPlayerSound,
  triggerDfPlayerAudio
} from '../services/dfplayerService';

interface BluetoothScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  deviceName: string;
  battery: number;
  bleState: ConnectionState;
  onConnect: (mode: 'all' | 'prefix') => Promise<void>;
  onDisconnect: () => void;
  frontDist: number;
  leftDist: number;
  rightDist: number;
}

export const BluetoothScannerModal: React.FC<BluetoothScannerModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  deviceName,
  battery,
  bleState,
  onConnect,
  onDisconnect,
  frontDist,
  leftDist,
  rightDist,
}) => {
  const [customFilter, setCustomFilter] = useState<'all' | 'prefix'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [testLog, setTestLog] = useState<string | null>(null);
  const [customCodeInput, setCustomCodeInput] = useState('A');
  const [selectedCategory, setSelectedCategory] = useState<number>(1);

  if (!isOpen) return null;

  const handleStartScan = async (mode: 'all' | 'prefix') => {
    setIsScanning(true);
    setCustomFilter(mode);
    try {
      await onConnect(mode);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestSound = async (code: string) => {
    const item = findDfPlayerSound(code);
    const label = item ? `${item.code} ➜ ${item.fileName} (${item.thaiText})` : `รหัส '${code}'`;
    setTestLog(`📡 กำลังส่งรหัส ${label}...`);

    // Also speak preview on phone
    if (item && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(item.thaiText);
      u.lang = 'th-TH';
      window.speechSynthesis.speak(u);
    }

    const success = await triggerDfPlayerAudio(code, (msg) => {
      setTestLog(msg);
    });

    if (!success && !isConnected) {
      setTestLog(`ℹ️ ยังไม่ได้ต่อหมวกจริง (จำลองเสียงตัวอย่างบนมือถือ: "${item?.thaiText || code}")`);
    }
  };

  const isSupported = bleHelmetService.isBluetoothSupported();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#070E1E] border border-cyan-500/30 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between bg-[#0A1428]">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-lg ${
              isConnected
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-emerald-950/50'
                : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400 shadow-cyan-950/50'
            }`}>
              <Bluetooth className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>เชื่อมต่อบลูทูธหมวกจริง</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  isConnected
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-600'
                }`}>
                  ESP32 BLE
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                เลือกชื่ออุปกรณ์บลูทูธเพื่อรับส่งข้อมูลเซนเซอร์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center transition hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs text-slate-200">

          {!isSupported && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-700/60 text-rose-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>เบราว์เซอร์ไม่รองรับ Web Bluetooth API</span>
              </div>
              <p className="text-[11px] text-rose-300/80 leading-relaxed">
                กรุณาเปิดแอปผ่าน Google Chrome หรือ Edge บนระบบ Android / PC และตรวจดูว่าได้เปิดสิทธิ์ Bluetooth ในเบราว์เซอร์แล้ว
              </p>
            </div>
          )}

          {/* Connected Device Status Card */}
          {isConnected ? (
            <div className="p-4 rounded-2xl bg-[#061224] border border-emerald-500/50 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      เชื่อมต่อสำเร็จแล้ว (Connected)
                    </div>
                    <div className="font-black text-sm text-white">{deviceName}</div>
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-xl bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{battery}%</span>
                </div>
              </div>

              {/* Real-time Distance Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">ซ้าย</div>
                  <div className="font-mono font-bold text-sm text-cyan-300">{leftDist} ซม.</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">หน้า</div>
                  <div className="font-mono font-bold text-sm text-teal-300">{frontDist} ซม.</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">ขวา</div>
                  <div className="font-mono font-bold text-sm text-cyan-300">{rightDist} ซม.</div>
                </div>
              </div>

              {/* Disconnect Button */}
              <button
                type="button"
                onClick={onDisconnect}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                <Bluetooth className="w-4 h-4" />
                <span>ตัดการเชื่อมต่ออุปกรณ์นี้</span>
              </button>
            </div>
          ) : (
            /* Action Scan & Select Flow */
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-[#061020] border border-cyan-800/40 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>ขั้นตอนการเลือกอุปกรณ์บลูทูธ:</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                  <li>กดปุ่ม <strong className="text-teal-300">"ค้นหาอุปกรณ์บลูทูธ (แสดงทุกชื่อ)"</strong> ด้านล่าง</li>
                  <li>เบราว์เซอร์จะเปิด <strong className="text-white">หน้าต่างรายการชื่อบลูทูธรอบตัว</strong> ขึ้นมา</li>
                  <li>มองหาชื่ออุปกรณ์หมวกของคุณ (เช่น <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300">ESP32-BLE</code>, <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300">SafeSight</code>, หรือชื่อที่ตั้งไว้)</li>
                  <li><strong className="text-teal-300">แตะที่ชื่ออุปกรณ์นั้น</strong> แล้วกดปุ่ม <strong>"จับคู่" (Pair)</strong></li>
                </ol>
              </div>

              {/* Primary Search Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={isScanning || bleState === 'connecting'}
                  onClick={() => handleStartScan('all')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-950/40 transition active:scale-98 disabled:opacity-50"
                >
                  {isScanning || bleState === 'connecting' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังรอการเลือกอุปกรณ์บลูทูธ...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 stroke-[2.5]" />
                      <span>ค้นหาอุปกรณ์บลูทูธทั้งหมด (แสดงทุกชื่อ)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isScanning || bleState === 'connecting'}
                  onClick={() => handleStartScan('prefix')}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#0B172E] hover:bg-[#112242] border border-cyan-700/50 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ค้นหาเฉพาะชื่อหมวด ESP32 / SafeSight</span>
                </button>
              </div>
            </div>
          )}

          {/* DFPlayer Mini Sound Trigger Testing Panel */}
          <div className="p-3.5 rounded-2xl bg-[#08152B] border border-cyan-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>ทดสอบส่งรหัสเสียง DFPlayer Mini บนหมวก</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono">
                BLE ➜ ESP32
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              แตะปุ่มเพื่อส่งรหัสสั้นผ่านบลูทูธให้ ESP32 สั่งเล่นไฟล์เสียง <code className="text-teal-300">.mp3</code> ออกลำโพงหมวก (พร้อมฟังตัวอย่างเสียงบนมือถือ):
            </p>

            {/* Quick action buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-0.5">
              {[
                { code: 'A', name: '0001 เริ่มนำทาง', color: 'border-emerald-600/60 bg-emerald-950/50 text-emerald-300' },
                { code: 'C', name: '0003 หยุดนำทาง', color: 'border-amber-600/60 bg-amber-950/50 text-amber-300' },
                { code: 'D', name: '0004 ถึงเป้าหมาย', color: 'border-cyan-600/60 bg-cyan-950/50 text-cyan-300' },
                { code: 'TL', name: '0032 เลี้ยวซ้าย', color: 'border-blue-600/60 bg-blue-950/50 text-blue-300' },
                { code: 'TR', name: '0034 เลี้ยวขวา', color: 'border-blue-600/60 bg-blue-950/50 text-blue-300' },
                { code: 'M0', name: '0028 อีก 0 เมตร', color: 'border-purple-600/60 bg-purple-950/50 text-purple-300' },
                { code: 'EU', name: '0060 กลับหลังหัน', color: 'border-rose-600/60 bg-rose-950/50 text-rose-300' },
                { code: 'OF', name: '0080 สิ่งกีดขวางหน้า', color: 'border-orange-600/60 bg-orange-950/50 text-orange-300' }
              ].map((btn) => (
                <button
                  key={btn.code}
                  type="button"
                  onClick={() => handleTestSound(btn.code)}
                  className={`py-2 px-1.5 rounded-xl border text-center font-bold text-[11px] hover:brightness-125 active:scale-95 transition flex flex-col items-center gap-0.5 shadow-sm ${btn.color}`}
                >
                  <span className="font-mono text-xs font-black">[{btn.code}]</span>
                  <span className="text-[9px] line-clamp-1 opacity-90">{btn.name}</span>
                </button>
              ))}
            </div>

            {/* Category Browser & Custom Code Input */}
            <div className="pt-1.5 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500 flex-1"
                >
                  <option value={1}>หมวด 1: สถานะการนำทาง (0001-0008)</option>
                  <option value={2}>หมวด 2: ระยะทางคงเหลือ (0010-0028)</option>
                  <option value={3}>หมวด 3: ทิศทางการเลี้ยว (0030-0044)</option>
                  <option value={4}>หมวด 4: ทิศทางเข็มทิศ 8 ทิศ (0050-0057)</option>
                  <option value={5}>หมวด 5: การเตือนเดินผิดทาง (0060-0064)</option>
                  <option value={6}>หมวด 6: ตำแหน่งทางเท้า (0070-0074)</option>
                  <option value={7}>หมวด 7: สิ่งกีดขวาง (0080-0085)</option>
                  <option value={8}>หมวด 8: สถานะระบบ (0090-0097)</option>
                </select>
              </div>

              {/* Items in selected category */}
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                {DFPLAYER_AUDIO_CATALOG.filter((item) => item.categoryNumber === selectedCategory).map((item) => (
                  <div
                    key={item.code}
                    onClick={() => handleTestSound(item.code)}
                    className="p-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/60 cursor-pointer flex items-center justify-between gap-2 transition text-[10px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
                        {item.code}
                      </span>
                      <span className="font-mono text-slate-400">({item.fileName})</span>
                      <span className="text-slate-200 truncate max-w-[170px]">{item.thaiText}</span>
                    </div>
                    <Play className="w-3 h-3 text-teal-400 flex-shrink-0" />
                  </div>
                ))}
              </div>

              {/* Custom Short Code Form */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="พิมพ์รหัส เช่น A, M50, TL"
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white uppercase font-mono flex-1 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => handleTestSound(customCodeInput)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>ส่งรหัส</span>
                </button>
              </div>

              {/* Realtime test log status */}
              {testLog && (
                <div className="p-2 rounded-xl bg-slate-900/90 border border-cyan-700/50 text-[11px] text-cyan-300 font-mono leading-tight">
                  {testLog}
                </div>
              )}
            </div>
          </div>

          {/* Quick Troubleshooting Guide */}
          <div className="p-3.5 rounded-2xl bg-[#050C18] border border-slate-800/80 space-y-2 text-[11px] text-slate-400">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>หากไม่พบชื่ออุปกรณ์ในรายการ:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>ตรวจสอบว่าเปิดสวิตช์จ่ายไฟให้บอร์ด ESP32 และหมวกแล้ว</li>
              <li>เปิด Bluetooth และตำแหน่ง (GPS/Location) บนสมาร์ตโฟนของคุณ</li>
              <li>นำหมวกเข้ามาใกล้โทรศัพท์มือถือในระยะ 1 - 5 เมตร</li>
              <li>หากอุปกรณ์เคยเชื่อมต่อกับเครื่องอื่นอยู่ ให้ตัดการเชื่อมต่อเครื่องเดิมก่อน</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/90 bg-[#0A1428] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
            <span>Web Bluetooth GATT Protocol</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
