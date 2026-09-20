import React, { useState } from 'react';
import { X, Search, Plus, MapPin, Clock, Trash2, Star, ChevronRight, Layers, Database, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { RouteItem } from './NavigationMap';

interface SavedRoutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRoutes: RouteItem[];
  currentGps?: { lat: number; lng: number };
  onSelectRoute: (route: RouteItem) => void;
  onDeleteRoute: (routeId: string) => void;
  onOpenRecorder: () => void;
  onSpeak: (text: string) => void;
  onPlayTone: (freq?: number, durationMs?: number) => void;
  highContrast?: boolean;
}

// Distance helper
function calcDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const SavedRoutesModal: React.FC<SavedRoutesModalProps> = ({
  isOpen,
  onClose,
  savedRoutes,
  currentGps,
  onSelectRoute,
  onDeleteRoute,
  onOpenRecorder,
  onSpeak,
  onPlayTone,
  highContrast = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('ทั้งหมด');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set<string>());
  const [routeToDelete, setRouteToDelete] = useState<RouteItem | null>(null);

  if (!isOpen) return null;

  const tags = ['ทั้งหมด', '#ทางเดินเท้า', '#ทางลาดคนพิการ', '#ปลอดภัย'];

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    onPlayTone(1000, 100);
  };

  const filteredRoutes = savedRoutes.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  const handleConfirmDelete = () => {
    if (!routeToDelete) return;
    const name = routeToDelete.name;
    onDeleteRoute(routeToDelete.id);
    onSpeak(`ลบเส้นทาง ${name} เรียบร้อยแล้วค่ะ`);
    onPlayTone(400, 150);
    setRouteToDelete(null);
  };

  const handleCancelDelete = () => {
    setRouteToDelete(null);
    onPlayTone(700, 80);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`bg-[#0A1224] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto space-y-4 p-4 sm:p-5 text-slate-100 max-h-[90vh] flex flex-col relative ${
        highContrast ? 'border-2 border-yellow-400 bg-black text-yellow-300' : ''
      }`}>
        
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">คลังเส้นทางจริง (Saved Routes)</h2>
              <p className="text-xs text-slate-400 leading-snug">
                เลือกเส้นทางจริงที่บันทึกไว้ เพื่อเริ่มนำทางด้วยเสียงและ GPS ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenRecorder();
              }}
              className="py-2 px-3 rounded-2xl bg-[#092E38] hover:bg-[#0E3E4B] text-teal-300 border border-teal-600/50 text-[11px] font-bold flex items-center gap-1.5 transition text-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกเส้นทางใหม่</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อเส้นทางที่บันทึกไว้..."
            className="w-full py-2.5 pl-9 pr-3 rounded-2xl bg-[#060D1A] border border-slate-800 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        </div>

        {/* TAGS FILTER */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                activeTag === tag
                  ? 'bg-teal-400 text-slate-950 shadow-md'
                  : 'bg-[#060D1A] text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* ROUTE LIST (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[50vh]">
          {filteredRoutes.length === 0 ? (
            <div className="py-8 px-4 rounded-3xl bg-[#060D1A] border border-dashed border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 mx-auto flex items-center justify-center border border-teal-500/20">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">ยังไม่มีเส้นทางที่บันทึกไว้</p>
                <p className="text-xs text-slate-400 mt-1">กดปุ่มด้านล่างเพื่อเริ่มเดินและบันทึกพิกัดจริงด้วย GPS หรือหมวก ESP32</p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenRecorder();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-950/40 transition active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ บันทึกเส้นทางเดินจริง (ไปยังหน้าบันทึกเส้นทาง)</span>
              </button>
            </div>
          ) : (
            filteredRoutes.map((route) => {
              const isFav = favoriteIds.has(route.id);
              const turnsCount = route.waypoints.length;
              const firstWp = route.waypoints && route.waypoints.length > 0 ? route.waypoints[0] : null;
              const lastWp = route.waypoints && route.waypoints.length > 0 ? route.waypoints[route.waypoints.length - 1] : null;

              let distA = 0;
              let distB = 0;
              let isNearA = false;
              let isNearB = false;
              let isOutOfRange = false;

              if (currentGps && firstWp && lastWp) {
                distA = calcDist(currentGps.lat, currentGps.lng, firstWp.lat, firstWp.lng);
                distB = calcDist(currentGps.lat, currentGps.lng, lastWp.lat, lastWp.lng);
                isNearA = distA <= 50 && distA <= distB;
                isNearB = distB <= 50 && distB < distA;
                isOutOfRange = distA > 50 && distB > 50;
              }

              return (
                <div
                  key={route.id}
                  className="p-4 rounded-3xl bg-[#0B152A] border border-slate-800/90 hover:border-slate-700/90 transition space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-base text-white">{route.name}</span>
                        {route.totalDistanceMeters > 10000 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-700/80 font-bold flex items-center gap-1">
                            🚫 เกิน 10 กม. (ระบบยกเลิกอัตโนมัติ)
                          </span>
                        )}
                        {route.isMarkedTarget ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-500/60 font-bold flex items-center gap-1">
                            🎯 จุดมาร์คเป้าหมาย (นำทางจาก GPS)
                          </span>
                        ) : (
                          <>
                            {route.totalDistanceMeters <= 10000 && isNearA && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-bold flex items-center gap-1">
                                📍 ขาไป (ใกล้เริ่ม {distA}ม.)
                              </span>
                            )}
                            {route.totalDistanceMeters <= 10000 && isNearB && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 font-bold flex items-center gap-1">
                                🔄 ขากลับ (ใกล้ปลายทาง {distB}ม.)
                              </span>
                            )}
                            {route.totalDistanceMeters <= 10000 && isOutOfRange && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/60 font-bold flex items-center gap-1">
                                ⚠️ ห่าง {Math.min(distA, distB)} ม. (&gt;50ม.)
                              </span>
                            )}
                          </>
                        )}
                        {isFav && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {isNearB
                          ? `สลับทิศทางขากลับอัตโนมัติ: ย้อนกลับไปยัง ${firstWp?.landmark || 'จุดเริ่มต้น'}`
                          : route.description || 'เส้นทางเดินเท้าบันทึกพิกัดจริง พร้อมจุดเตือนทางเลี้ยว...'}
                      </p>
                    </div>
                  </div>

                  {/* STATS (DISTANCE / TIME / TURNS) */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-teal-400" />
                      <span>{route.totalDistanceMeters} เมตร</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>~{route.estimatedMinutes || 1} นาที</span>
                    </span>
                    <span>• {turnsCount} จุดเลี้ยว</span>
                  </div>

                  {/* BOTTOM BUTTONS (STAR, DELETE, NAVIGATE) */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={(e) => toggleFavorite(route.id, e)}
                      className="w-10 h-10 rounded-2xl bg-[#060D1A] hover:bg-[#101F3B] border border-slate-800 flex items-center justify-center transition"
                      title="ติดดาวเส้นทางโปรด"
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRouteToDelete(route);
                        onSpeak(`คุณแน่ใจหรือไม่ว่าต้องการลบเส้นทาง ${route.name} คะ?`);
                        onPlayTone(600, 100);
                      }}
                      className="w-10 h-10 rounded-2xl bg-[#060D1A] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 flex items-center justify-center transition"
                      title="ลบเส้นทาง"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        onSelectRoute(route);
                      }}
                      className={`flex-1 py-2.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
                        isNearB
                          ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 shadow-cyan-950/50'
                          : isNearA
                          ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 shadow-teal-950/50'
                          : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-950/40'
                      }`}
                    >
                      {isNearB ? (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>นำทาง (ขากลับ)</span>
                        </>
                      ) : isNearA ? (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          <span>นำทาง (ขาไป)</span>
                        </>
                      ) : (
                        <>
                          <span>นำทาง</span>
                          <ChevronRight className="w-4 h-4 stroke-[3]" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER SYNC STATUS */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>รวม {savedRoutes.length} เส้นทางพร้อมใช้งาน</span>
          <div className="flex items-center gap-1.5 text-teal-400">
            <Database className="w-3.5 h-3.5" />
            <span>ซิงค์กับ ESP32 & Firebase เรียบร้อย</span>
          </div>
        </div>

        {/* DELETE CONFIRMATION DIALOG (MODAL OVERLAY) */}
        {routeToDelete && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-3xl z-30 flex items-center justify-center p-4">
            <div className="bg-[#0F1B33] border border-rose-500/40 rounded-3xl p-5 sm:p-6 w-full max-w-sm text-center space-y-4 shadow-2xl shadow-rose-950/40 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center shadow-inner">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-black text-white">คุณแน่ใจว่าจะลบ?</h4>
                <div className="py-1 px-3 rounded-xl bg-rose-950/60 border border-rose-800/40 inline-block max-w-full">
                  <span className="text-xs text-rose-300 font-bold truncate block max-w-[240px]">
                    {routeToDelete.name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  ข้อมูลพิกัดและจุดเตือนในเส้นทางนี้จะถูกลบออกจากคลังเส้นทาง
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCancelDelete}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 transition active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>ยืนยัน</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
