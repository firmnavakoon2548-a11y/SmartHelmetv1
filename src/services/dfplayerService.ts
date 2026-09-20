/**
 * DFPlayer Mini & Smart Helmet Audio Code Service
 * Translates voice navigation alerts into compact codes (e.g. 'A', 'TL', 'M50')
 * and transmits them over Web Bluetooth (BLE) to the ESP32 Smart Helmet.
 * The ESP32 matches the code and commands DFPlayer Mini to play the corresponding
 * numbered MP3 file (e.g. 0001.mp3, 0032.mp3) to the onboard helmet speaker.
 */

import { bleHelmetService } from './bleHelmetService';

export interface DfPlayerSoundItem {
  code: string;            // Short BLE code (e.g. 'A', 'B', 'TL', 'M50')
  aliases?: string[];      // Alternative codes that map to the same audio (e.g. 'A1', '1')
  mp3Number: number;       // MP3 file index (e.g. 1 -> 0001.mp3)
  fileName: string;        // Formatted filename "0001.mp3"
  categoryNumber: number;  // Category 1 to 8
  categoryName: string;    // Thai category title
  thaiText: string;        // Spoken Thai script
  triggerDescription: string;
}

export const DFPLAYER_AUDIO_CATALOG: DfPlayerSoundItem[] = [
  // ==========================================
  // หมวดที่ 1: สถานะการนำทาง (0001 - 0008.mp3)
  // ==========================================
  {
    code: 'A',
    aliases: ['A1', 'START_NAV'],
    mp3Number: 1,
    fileName: '0001.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'เริ่มต้นการนำทางค่ะ กรุณาเดินตามคำแนะนำเสียง',
    triggerDescription: 'แจ้งเตือนเมื่อกดปุ่มเริ่มนำทางเส้นทางขาไป'
  },
  {
    code: 'B',
    aliases: ['A2', 'RETURN_NAV'],
    mp3Number: 2,
    fileName: '0002.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'เริ่มต้นการนำทางขากลับค่ะ ระบบได้สลับเส้นทางย้อนกลับให้อัตโนมัติ',
    triggerDescription: 'แจ้งเตือนเมื่อระบบตรวจพบว่าผู้ใช้อยู่ใกล้จุดปลายทางและสลับนำทางขากลับ'
  },
  {
    code: 'C',
    aliases: ['A3', 'STOP_NAV'],
    mp3Number: 3,
    fileName: '0003.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'หยุดการนำทางแล้วค่ะ',
    triggerDescription: 'แจ้งเตือนเมื่อผู้ใช้กดปุ่มหยุดนำทาง'
  },
  {
    code: 'D',
    aliases: ['A4', 'ARRIVED'],
    mp3Number: 4,
    fileName: '0004.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'ยินดีด้วยค่ะ คุณเดินทางถึงจุดหมายปลายทางเรียบร้อยแล้วค่ะ',
    triggerDescription: 'แจ้งเตือนเมื่อเดินถึงจุดหมายสุดท้าย (ระยะ 0 เมตร)'
  },
  {
    code: 'E',
    aliases: ['A5', 'OVER_10KM'],
    mp3Number: 5,
    fileName: '0005.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'ปลายทางอยู่ไกลเกิน 10 กิโลเมตร ระบบได้ยกเลิกการนำทางอัตโนมัติเพื่อความปลอดภัยค่ะ',
    triggerDescription: 'แจ้งเตือนความปลอดภัยกรณีเลือกจุดหมายเกินขอบเขตการเดินเท้า'
  },
  {
    code: 'F',
    aliases: ['A6', 'CALCULATING'],
    mp3Number: 6,
    fileName: '0006.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'กำลังคำนวณเส้นทางเดินเท้า กรุณารอสักครู่ค่ะ',
    triggerDescription: 'แจ้งเตือนขณะระบบกำลังดึงข้อมูลแผนที่และเส้นทางเท้า'
  },
  {
    code: 'G',
    aliases: ['A7', 'ROUTE_SELECTED'],
    mp3Number: 7,
    fileName: '0007.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'เลือกเส้นทางเรียบร้อยแล้วค่ะ กดเริ่มการนำทางได้เลยค่ะ',
    triggerDescription: 'แจ้งเตือนเมื่อเลือกเส้นทางจากคลังบันทึกพร้อมเดิน'
  },
  {
    code: 'H',
    aliases: ['A8', 'NO_ACTIVE_ROUTE'],
    mp3Number: 8,
    fileName: '0008.mp3',
    categoryNumber: 1,
    categoryName: 'สถานะการนำทาง',
    thaiText: 'ยังไม่มีเส้นทางที่กำลังนำทางค่ะ กรุณาเลือกจุดหมายก่อน',
    triggerDescription: 'แจ้งเตือนเมื่อกดปุ่มฟังเสียงซ้ำแต่ยังไม่ได้เริ่มนำทาง'
  },

  // ==========================================
  // หมวดที่ 2: ระยะทางคงเหลือเข้าสู่จุดเลี้ยว (0010 - 0028.mp3)
  // ==========================================
  {
    code: 'M1000',
    aliases: ['D1000', 'DIST_1000'],
    mp3Number: 10,
    fileName: '0010.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 1 กิโลเมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 1,000 เมตร'
  },
  {
    code: 'M500',
    aliases: ['D500', 'DIST_500'],
    mp3Number: 11,
    fileName: '0011.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 500 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 500 เมตร'
  },
  {
    code: 'M300',
    aliases: ['D300', 'DIST_300'],
    mp3Number: 12,
    fileName: '0012.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 300 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 300 เมตร'
  },
  {
    code: 'M200',
    aliases: ['D200', 'DIST_200'],
    mp3Number: 13,
    fileName: '0013.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 200 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 200 เมตร'
  },
  {
    code: 'M150',
    aliases: ['D150', 'DIST_150'],
    mp3Number: 14,
    fileName: '0014.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 150 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 150 เมตร'
  },
  {
    code: 'M100',
    aliases: ['D100', 'DIST_100'],
    mp3Number: 15,
    fileName: '0015.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 100 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 100 เมตร'
  },
  {
    code: 'M90',
    aliases: ['D90'],
    mp3Number: 16,
    fileName: '0016.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 90 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 90 เมตร'
  },
  {
    code: 'M80',
    aliases: ['D80'],
    mp3Number: 17,
    fileName: '0017.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 80 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 80 เมตร'
  },
  {
    code: 'M70',
    aliases: ['D70'],
    mp3Number: 18,
    fileName: '0018.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 70 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 70 เมตร'
  },
  {
    code: 'M60',
    aliases: ['D60'],
    mp3Number: 19,
    fileName: '0019.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 60 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 60 เมตร'
  },
  {
    code: 'M50',
    aliases: ['D50'],
    mp3Number: 20,
    fileName: '0020.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 50 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 50 เมตร'
  },
  {
    code: 'M40',
    aliases: ['D40'],
    mp3Number: 21,
    fileName: '0021.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 40 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 40 เมตร'
  },
  {
    code: 'M30',
    aliases: ['D30'],
    mp3Number: 22,
    fileName: '0022.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 30 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 30 เมตร'
  },
  {
    code: 'M25',
    aliases: ['D25'],
    mp3Number: 23,
    fileName: '0023.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 25 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 25 เมตร'
  },
  {
    code: 'M20',
    aliases: ['D20'],
    mp3Number: 24,
    fileName: '0024.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 20 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 20 เมตร'
  },
  {
    code: 'M15',
    aliases: ['D15'],
    mp3Number: 25,
    fileName: '0025.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 15 เมตร',
    triggerDescription: 'แจ้งเตือนระยะทางคงเหลือ 15 เมตร (เตรียมเลี้ยว)'
  },
  {
    code: 'M10',
    aliases: ['D10'],
    mp3Number: 26,
    fileName: '0026.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 10 เมตร',
    triggerDescription: 'แจ้งเตือนระยะประชิด 10 เมตร (ชะลอความเร็ว)'
  },
  {
    code: 'M5',
    aliases: ['D5'],
    mp3Number: 27,
    fileName: '0027.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 5 เมตร',
    triggerDescription: 'แจ้งเตือนระยะประชิด 5 เมตร (เตรียมเปลี่ยนทิศทางทันที)'
  },
  {
    code: 'M0',
    aliases: ['D0', 'ZERO'],
    mp3Number: 28,
    fileName: '0028.mp3',
    categoryNumber: 2,
    categoryName: 'ระยะทางคงเหลือ',
    thaiText: 'อีก 0 เมตร ถึงจุดเลี้ยวแล้วค่ะ',
    triggerDescription: 'แจ้งเตือนเมื่อก้าวถึงตำแหน่งจุดเลี้ยวพอดี'
  },

  // ==========================================
  // หมวดที่ 3: ทิศทางการเลี้ยวและการเคลื่อนที่ (0030 - 0044.mp3)
  // ==========================================
  {
    code: 'TS',
    aliases: ['T1', 'STRAIGHT', 'S'],
    mp3Number: 30,
    fileName: '0030.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เดินตรงไปข้างหน้า',
    triggerDescription: 'คำสั่งให้เดินตรงต่อไปตามแนวทางเท้า'
  },
  {
    code: 'TNL',
    aliases: ['T2', 'NEXT_LEFT'],
    mp3Number: 31,
    fileName: '0031.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ข้างหน้าเลี้ยวซ้าย',
    triggerDescription: 'คำสั่งเตือนล่วงหน้าก่อนถึงจุดเลี้ยวซ้าย'
  },
  {
    code: 'TL',
    aliases: ['T3', 'LEFT', 'L'],
    mp3Number: 32,
    fileName: '0032.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เลี้ยวซ้าย',
    triggerDescription: 'คำสั่งให้ทำการเลี้ยวซ้ายทันที ณ จุดเลี้ยว'
  },
  {
    code: 'TNR',
    aliases: ['T4', 'NEXT_RIGHT'],
    mp3Number: 33,
    fileName: '0033.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ข้างหน้าเลี้ยวขวา',
    triggerDescription: 'คำสั่งเตือนล่วงหน้าก่อนถึงจุดเลี้ยวขวา'
  },
  {
    code: 'TR',
    aliases: ['T5', 'RIGHT', 'R'],
    mp3Number: 34,
    fileName: '0034.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เลี้ยวขวา',
    triggerDescription: 'คำสั่งให้ทำการเลี้ยวขวาทันที ณ จุดเลี้ยว'
  },
  {
    code: 'TSL',
    aliases: ['T6', 'SLIGHT_LEFT'],
    mp3Number: 35,
    fileName: '0035.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เบี่ยงซ้ายเล็กน้อย โค้งตามทาง',
    triggerDescription: 'ทางข้างหน้าเป็นทางโค้งซ้ายตามแนวถนน'
  },
  {
    code: 'TSR',
    aliases: ['T7', 'SLIGHT_RIGHT'],
    mp3Number: 36,
    fileName: '0036.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เบี่ยงขวาเล็กน้อย โค้งตามทาง',
    triggerDescription: 'ทางข้างหน้าเป็นทางโค้งขวาตามแนวถนน'
  },
  {
    code: 'TSHL',
    aliases: ['T8', 'SHARP_LEFT'],
    mp3Number: 37,
    fileName: '0037.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เลี้ยวซ้ายหักศอก',
    triggerDescription: 'จุดเลี้ยวซ้ายมุมแคบหรือหักมุมชัน'
  },
  {
    code: 'TSHR',
    aliases: ['T9', 'SHARP_RIGHT'],
    mp3Number: 38,
    fileName: '0038.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'เลี้ยวขวาหักศอก',
    triggerDescription: 'จุดเลี้ยวขวามุมแคบหรือหักมุมชัน'
  },
  {
    code: 'TU',
    aliases: ['T10', 'UTURN', 'U'],
    mp3Number: 39,
    fileName: '0039.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'กลับหลังหัน ยูเทิร์น',
    triggerDescription: 'คำสั่งให้หมุนตัวกลับหลัง 180 องศา'
  },
  {
    code: 'TX',
    aliases: ['T11', 'CROSS_ROAD'],
    mp3Number: 40,
    fileName: '0040.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ข้างหน้าเตรียมข้ามถนน',
    triggerDescription: 'เตือนล่วงหน้าก่อนถึงจุดที่ต้องข้ามถนน'
  },
  {
    code: 'TC',
    aliases: ['T12', 'CROSSWALK'],
    mp3Number: 41,
    fileName: '0041.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ข้างหน้าเป็นทางม้าลาย ระวังรถแล้วเดินข้ามทางม้าลายค่ะ',
    triggerDescription: 'เตือนจุดข้ามทางม้าลาย'
  },
  {
    code: 'TB',
    aliases: ['T13', 'OVERPASS_UP'],
    mp3Number: 42,
    fileName: '0042.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ข้างหน้ามีสะพานลอย เตรียมขึ้นสะพานลอยค่ะ',
    triggerDescription: 'เตือนตำแหน่งบันไดขึ้นสะพานลอยคนข้าม'
  },
  {
    code: 'TD',
    aliases: ['T14', 'OVERPASS_DOWN'],
    mp3Number: 43,
    fileName: '0043.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ลงสะพานลอยระวังบันไดค่ะ',
    triggerDescription: 'เตือนตำแหน่งบันไดลงสะพานลอย'
  },
  {
    code: 'TRP',
    aliases: ['T15', 'RAMP'],
    mp3Number: 44,
    fileName: '0044.mp3',
    categoryNumber: 3,
    categoryName: 'ทิศทางการเลี้ยว',
    thaiText: 'ระวังทางลาดชันข้างหน้า',
    triggerDescription: 'เตือนทางลาดขึ้น/ลงฟุตบาท'
  },

  // ==========================================
  // หมวดที่ 4: ทิศทางตามเข็มทิศ 8 ทิศ (0050 - 0057.mp3)
  // ==========================================
  {
    code: 'CN',
    aliases: ['C1', 'COMPASS_N'],
    mp3Number: 50,
    fileName: '0050.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศเหนือ',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 337.5° – 22.5°)'
  },
  {
    code: 'CNE',
    aliases: ['C2', 'COMPASS_NE'],
    mp3Number: 51,
    fileName: '0051.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศตะวันออกเฉียงเหนือ',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 22.5° – 67.5°)'
  },
  {
    code: 'CE',
    aliases: ['C3', 'COMPASS_E'],
    mp3Number: 52,
    fileName: '0052.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศตะวันออก',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 67.5° – 112.5°)'
  },
  {
    code: 'CSE',
    aliases: ['C4', 'COMPASS_SE'],
    mp3Number: 53,
    fileName: '0053.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศตะวันออกเฉียงใต้',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 112.5° – 157.5°)'
  },
  {
    code: 'CS',
    aliases: ['C5', 'COMPASS_S'],
    mp3Number: 54,
    fileName: '0054.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศใต้',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 157.5° – 202.5°)'
  },
  {
    code: 'CSW',
    aliases: ['C6', 'COMPASS_SW'],
    mp3Number: 55,
    fileName: '0055.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศตะวันตกเฉียงใต้',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 202.5° – 247.5°)'
  },
  {
    code: 'CW',
    aliases: ['C7', 'COMPASS_W'],
    mp3Number: 56,
    fileName: '0056.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศตะวันตก',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 247.5° – 292.5°)'
  },
  {
    code: 'CNW',
    aliases: ['C8', 'COMPASS_NW'],
    mp3Number: 57,
    fileName: '0057.mp3',
    categoryNumber: 4,
    categoryName: 'ทิศทางตามเข็มทิศ',
    thaiText: 'มุ่งหน้าทิศตะวันตกเฉียงเหนือ',
    triggerDescription: 'แจ้งทิศทางเข็มทิศ (ช่วงมุม 292.5° – 337.5°)'
  },

  // ==========================================
  // หมวดที่ 5: การเตือนเดินผิดทาง (0060 - 0064.mp3)
  // ==========================================
  {
    code: 'EU',
    aliases: ['E1', 'OFFROUTE_UTURN'],
    mp3Number: 60,
    fileName: '0060.mp3',
    categoryNumber: 5,
    categoryName: 'การเตือนเดินผิดทาง',
    thaiText: 'เตือนเดินผิดทาง ออกนอกเส้นทาง กรุณากลับหลังหันเพื่อกลับสู่เส้นทางค่ะ',
    triggerDescription: 'ผู้ใช้เดินย้อนศร หรือเดินหันหลังออกจากจุดหมาย'
  },
  {
    code: 'EL',
    aliases: ['E2', 'OFFROUTE_LEFT'],
    mp3Number: 61,
    fileName: '0061.mp3',
    categoryNumber: 5,
    categoryName: 'การเตือนเดินผิดทาง',
    thaiText: 'เตือนเดินผิดทาง ออกนอกเส้นทาง ข้างหน้ากรุณาเลี้ยวซ้ายเพื่อกลับสู่เส้นทางค่ะ',
    triggerDescription: 'ผู้ใช้เดินเบี่ยงออกทางขวาเกินแนวถนน ต้องเลี้ยวซ้ายกลับเข้าทาง'
  },
  {
    code: 'ER',
    aliases: ['E3', 'OFFROUTE_RIGHT'],
    mp3Number: 62,
    fileName: '0062.mp3',
    categoryNumber: 5,
    categoryName: 'การเตือนเดินผิดทาง',
    thaiText: 'เตือนเดินผิดทาง ออกนอกเส้นทาง ข้างหน้ากรุณาเลี้ยวขวาเพื่อกลับสู่เส้นทางค่ะ',
    triggerDescription: 'ผู้ใช้เดินเบี่ยงออกทางซ้ายเกินแนวถนน ต้องเลี้ยวขวากลับเข้าทาง'
  },
  {
    code: 'ES',
    aliases: ['E4', 'OFFROUTE_STRAIGHT'],
    mp3Number: 63,
    fileName: '0063.mp3',
    categoryNumber: 5,
    categoryName: 'การเตือนเดินผิดทาง',
    thaiText: 'เตือนเดินผิดทาง ออกนอกเส้นทาง กรุณาเดินตรงไปเพื่อกลับสู่เส้นทางค่ะ',
    triggerDescription: 'ผู้ใช้หลุดออกจากแนวทางเท้า แต่ทิศทางยังมุ่งสู่เส้นทางได้'
  },
  {
    code: 'EOK',
    aliases: ['E5', 'ROUTE_RECOVERED'],
    mp3Number: 64,
    fileName: '0064.mp3',
    categoryNumber: 5,
    categoryName: 'การเตือนเดินผิดทาง',
    thaiText: 'กลับเข้าสู่เส้นทางแล้วค่ะ',
    triggerDescription: 'แจ้งเตือนเมื่อเดินกลับเข้ามาอยู่ในแนวทางเดินที่ถูกต้อง'
  },

  // ==========================================
  // หมวดที่ 6: ตำแหน่งทางเท้าและแนวกันชนถนน (0070 - 0074.mp3)
  // ==========================================
  {
    code: 'SL',
    aliases: ['S1', 'SIDEWALK_LEFT'],
    mp3Number: 70,
    fileName: '0070.mp3',
    categoryNumber: 6,
    categoryName: 'ตำแหน่งทางเท้า',
    thaiText: 'เดินริมทางเท้าฝั่งซ้าย',
    triggerDescription: 'ยืนยันว่ากำลังเดินบนทางเท้าฝั่งซ้ายของถนนถูกต้อง'
  },
  {
    code: 'SR',
    aliases: ['S2', 'SIDEWALK_RIGHT'],
    mp3Number: 71,
    fileName: '0071.mp3',
    categoryNumber: 6,
    categoryName: 'ตำแหน่งทางเท้า',
    thaiText: 'เดินริมทางเท้าฝั่งขวา',
    triggerDescription: 'ยืนยันว่ากำลังเดินบนทางเท้าฝั่งขวาของถนนถูกต้อง'
  },
  {
    code: 'SC',
    aliases: ['S3', 'SIDEWALK_CENTER'],
    mp3Number: 72,
    fileName: '0072.mp3',
    categoryNumber: 6,
    categoryName: 'ตำแหน่งทางเท้า',
    thaiText: 'เดินกึ่งกลางทางเดิน',
    triggerDescription: 'เดินอยู่บริเวณกึ่งกลางแนวทางเดิน'
  },
  {
    code: 'SW',
    aliases: ['S4', 'EDGE_WARNING'],
    mp3Number: 73,
    fileName: '0073.mp3',
    categoryNumber: 6,
    categoryName: 'ตำแหน่งทางเท้า',
    thaiText: 'ระวัง ชิดขอบถนนเกินไป กรุณาเบี่ยงเข้าทางเท้า',
    triggerDescription: 'เตือนเมื่อเดินเฉียดเข้าไปในเลนถนนที่มีรถสัญจร'
  },
  {
    code: 'SOK',
    aliases: ['S5', 'SIDEWALK_SAFE'],
    mp3Number: 74,
    fileName: '0074.mp3',
    categoryNumber: 6,
    categoryName: 'ตำแหน่งทางเท้า',
    thaiText: 'กำลังเดินตามแนวทางเท้า ปลอดภัยค่ะ',
    triggerDescription: 'ให้ความมั่นใจแก่ผู้พิการเมื่อเดินตรงแนวต่อเนื่อง'
  },

  // ==========================================
  // หมวดที่ 7: สิ่งกีดขวางจากเซนเซอร์หมวก (0080 - 0085.mp3)
  // ==========================================
  {
    code: 'OF',
    aliases: ['O1', 'OBS_FRONT'],
    mp3Number: 80,
    fileName: '0080.mp3',
    categoryNumber: 7,
    categoryName: 'สิ่งกีดขวาง',
    thaiText: 'ตรวจพบสิ่งกีดขวางด้านหน้า กรุณาหยุดหรือชะลอความเร็วค่ะ',
    triggerDescription: 'เซนเซอร์อัลตราโซนิกด้านหน้าตรวจพบวัตถุในระยะ 0.8–1.5 ม.'
  },
  {
    code: 'OL',
    aliases: ['O2', 'OBS_LEFT'],
    mp3Number: 81,
    fileName: '0081.mp3',
    categoryNumber: 7,
    categoryName: 'สิ่งกีดขวาง',
    thaiText: 'มีสิ่งกีดขวางด้านซ้าย กรุณาเบี่ยงขวาเล็กน้อยค่ะ',
    triggerDescription: 'เซนเซอร์ด้านซ้ายตรวจพบวัตถุ/เสา/สิ่งกีดขวาง'
  },
  {
    code: 'OR',
    aliases: ['O3', 'OBS_RIGHT'],
    mp3Number: 82,
    fileName: '0082.mp3',
    categoryNumber: 7,
    categoryName: 'สิ่งกีดขวาง',
    thaiText: 'มีสิ่งกีดขวางด้านขวา กรุณาเบี่ยงซ้ายเล็กน้อยค่ะ',
    triggerDescription: 'เซนเซอร์ด้านขวาตรวจพบวัตถุ/สิ่งกีดขวาง'
  },
  {
    code: 'OH',
    aliases: ['O4', 'OBS_HEAD'],
    mp3Number: 83,
    fileName: '0083.mp3',
    categoryNumber: 7,
    categoryName: 'สิ่งกีดขวาง',
    thaiText: 'ระวัง สิ่งกีดขวางระดับศีรษะหรือป้ายด้านบนค่ะ',
    triggerDescription: 'ตรวจพบสิ่งกีดขวางระดับหัว เช่น ป้ายโฆษณา กันสาด กิ่งไม้'
  },
  {
    code: 'OG',
    aliases: ['O5', 'OBS_GROUND'],
    mp3Number: 84,
    fileName: '0084.mp3',
    categoryNumber: 7,
    categoryName: 'สิ่งกีดขวาง',
    thaiText: 'ระวัง ทางต่างระดับ หลุม หรือท่อระบายน้ำด้านหน้าค่ะ',
    triggerDescription: 'ตรวจพบพื้นยุบลงหรือท่อระบายน้ำที่อันตราย'
  },
  {
    code: 'OC',
    aliases: ['O6', 'OBS_CLEAR'],
    mp3Number: 85,
    fileName: '0085.mp3',
    categoryNumber: 7,
    categoryName: 'สิ่งกีดขวาง',
    thaiText: 'ทางข้างหน้าโล่ง เดินต่อไปได้ค่ะ',
    triggerDescription: 'สิ่งกีดขวางพ้นระยะแล้ว ปลอดภัย'
  },

  // ==========================================
  // หมวดที่ 8: สถานะระบบและบลูทูธ (0090 - 0097.mp3)
  // ==========================================
  {
    code: 'HB',
    aliases: ['H1', 'BLE_CONNECTED'],
    mp3Number: 90,
    fileName: '0090.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'เชื่อมต่อหมวกอัจฉริยะบลูทูธเรียบร้อยแล้วค่ะ',
    triggerDescription: 'แจ้งเมื่อเชื่อมต่อ BLE กับบอร์ด ESP32 สำเร็จ'
  },
  {
    code: 'HD',
    aliases: ['H2', 'BLE_DISCONNECTED'],
    mp3Number: 91,
    fileName: '0091.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'การเชื่อมต่อหมวกอัจฉริยะหลุด กรุณาตรวจสอบบลูทูธค่ะ',
    triggerDescription: 'แจ้งเมื่อสัญญาณบลูทูธกับหมวกขาดหาย'
  },
  {
    code: 'HG',
    aliases: ['H3', 'GPS_READY'],
    mp3Number: 92,
    fileName: '0092.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'สัญญาณจีพีเอสพร้อมนำทางแล้วค่ะ',
    triggerDescription: 'แจ้งเมื่อรับค่าพิกัดดาวเทียมได้แม่นยำ'
  },
  {
    code: 'HW',
    aliases: ['H4', 'GPS_WEAK'],
    mp3Number: 93,
    fileName: '0093.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'สัญญาณจีพีเอสอ่อน กำลังค้นหาสัญญาณดาวเทียมค่ะ',
    triggerDescription: 'แจ้งเมื่อสัญญาณดาวเทียมคลาดเคลื่อนหรืออยู่ในอาคาร'
  },
  {
    code: 'HL',
    aliases: ['H5', 'BATT_LOW'],
    mp3Number: 94,
    fileName: '0094.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'แบตเตอรี่หมวกอัจฉริยะเหลือต่ำกว่า 20 เปอร์เซ็นต์ กรุณาชาร์จค่ะ',
    triggerDescription: 'เตือนสถานะแบตเตอรี่ใกล้หมด'
  },
  {
    code: 'HR',
    aliases: ['H6', 'REC_START'],
    mp3Number: 95,
    fileName: '0095.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'เริ่มต้นบันทึกเส้นทางใหม่ค่ะ',
    triggerDescription: 'แจ้งเมื่อเริ่มโหมดบันทึกจุด Waypoints ด้วยตนเอง'
  },
  {
    code: 'HS',
    aliases: ['H7', 'REC_SAVED'],
    mp3Number: 96,
    fileName: '0096.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'บันทึกเส้นทางสำเร็จและจัดเก็บลงในระบบแล้วค่ะ',
    triggerDescription: 'แจ้งเมื่อกดบันทึกเส้นทางเสร็จสมบูรณ์'
  },
  {
    code: 'HWP',
    aliases: ['H8', 'REC_WAYPOINT'],
    mp3Number: 97,
    fileName: '0097.mp3',
    categoryNumber: 8,
    categoryName: 'สถานะระบบ',
    thaiText: 'บันทึกจุดเลี้ยวเรียบร้อยแล้วค่ะ',
    triggerDescription: 'แจ้งทุกครั้งที่กดปุ่มปักหมุดจุดเลี้ยวระหว่างทาง'
  }
];

// Quick index lookup map for instant O(1) resolution
const CODE_MAP = new Map<string, DfPlayerSoundItem>();
for (const item of DFPLAYER_AUDIO_CATALOG) {
  CODE_MAP.set(item.code.toUpperCase(), item);
  if (item.aliases) {
    for (const alias of item.aliases) {
      CODE_MAP.set(alias.toUpperCase(), item);
    }
  }
}

/**
 * Finds a DfPlayerSoundItem by short code or alias
 */
export function findDfPlayerSound(codeOrAlias: string): DfPlayerSoundItem | undefined {
  if (!codeOrAlias) return undefined;
  return CODE_MAP.get(codeOrAlias.trim().toUpperCase());
}

/**
 * Maps a navigation turn direction to a short DFPlayer code
 */
export function mapTurnToDfPlayerCode(direction?: string): string {
  if (!direction) return 'TS'; // default straight
  const lower = direction.toLowerCase().trim();
  if (lower.includes('sharp_left') || lower.includes('หักศอกซ้าย')) return 'TSHL';
  if (lower.includes('sharp_right') || lower.includes('หักศอกขวา')) return 'TSHR';
  if (lower.includes('slight_left') || lower.includes('เบี่ยงซ้าย') || lower.includes('โค้งซ้าย')) return 'TSL';
  if (lower.includes('slight_right') || lower.includes('เบี่ยงขวา') || lower.includes('โค้งขวา')) return 'TSR';
  if (lower.includes('left') || lower.includes('ซ้าย')) return 'TL';
  if (lower.includes('right') || lower.includes('ขวา')) return 'TR';
  if (lower.includes('uturn') || lower.includes('กลับหลัง') || lower.includes('ยูเทิร์น')) return 'TU';
  return 'TS'; // straight
}

/**
 * Maps distance in meters to nearest milestone code
 */
export function mapDistanceToDfPlayerCode(distMeters: number): string | null {
  const d = Math.round(distMeters);
  if (d <= 2) return 'M0';
  if (d <= 7 && d >= 3) return 'M5';
  if (d <= 12 && d >= 8) return 'M10';
  if (d <= 17 && d >= 13) return 'M15';
  if (d <= 22 && d >= 18) return 'M20';
  if (d <= 27 && d >= 23) return 'M25';
  if (d <= 35 && d >= 28) return 'M30';
  if (d <= 45 && d >= 36) return 'M40';
  if (d <= 55 && d >= 46) return 'M50';
  if (d <= 65 && d >= 56) return 'M60';
  if (d <= 75 && d >= 66) return 'M70';
  if (d <= 85 && d >= 76) return 'M80';
  if (d <= 95 && d >= 86) return 'M90';
  if (d <= 110 && d >= 96) return 'M100';
  if (d <= 165 && d >= 135) return 'M150';
  if (d <= 220 && d >= 180) return 'M200';
  if (d <= 320 && d >= 280) return 'M300';
  if (d <= 530 && d >= 470) return 'M500';
  if (d <= 1050 && d >= 950) return 'M1000';
  return null;
}

/**
 * Maps heading degrees (0 - 360) to 8 cardinal compass codes
 */
export function mapHeadingToCompassCode(bearing: number): string {
  const normalized = (bearing % 360 + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'CN';
  if (normalized >= 22.5 && normalized < 67.5) return 'CNE';
  if (normalized >= 67.5 && normalized < 112.5) return 'CE';
  if (normalized >= 112.5 && normalized < 157.5) return 'CSE';
  if (normalized >= 157.5 && normalized < 202.5) return 'CS';
  if (normalized >= 202.5 && normalized < 247.5) return 'CSW';
  if (normalized >= 247.5 && normalized < 292.5) return 'CW';
  return 'CNW';
}

/**
 * Transmits a short code over Web Bluetooth (BLE) to the ESP32.
 * The ESP32 parses this code and commands DFPlayer Mini to play the track.
 */
export async function triggerDfPlayerAudio(
  code: string,
  logCallback?: (message: string) => void
): Promise<boolean> {
  const item = findDfPlayerSound(code);
  const codeToSend = item ? item.code : code.trim().toUpperCase();
  const desc = item ? `${item.fileName} (${item.thaiText})` : `รหัส ${codeToSend}`;

  if (!bleHelmetService.isConnected()) {
    logCallback?.(`⚠️ [DFPlayer] หมวกยังไม่ได้เชื่อมต่อบลูทูธ (ข้ามการส่งรหัส '${codeToSend}')`);
    return false;
  }

  try {
    // Send short code with newline delimiter for ESP32 UART buffer parsing
    const success = await bleHelmetService.sendCommand(`${codeToSend}\n`);
    if (success) {
      logCallback?.(`📡 [BLE ➜ ESP32] ส่งรหัสสั้น '${codeToSend}' ➜ สั่งเล่น MP3: ${desc}`);
      return true;
    } else {
      logCallback?.(`❌ [BLE ➜ ESP32] ส่งรหัส '${codeToSend}' ล้มเหลว`);
      return false;
    }
  } catch (err) {
    console.error('triggerDfPlayerAudio error:', err);
    logCallback?.(`❌ [BLE ➜ ESP32] เกิดข้อผิดพลาดในการส่งรหัส '${codeToSend}'`);
    return false;
  }
}
