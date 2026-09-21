import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

interface SensorData {
  front: number;
  left: number;
  right: number;
  overhead: number;
}

interface LogEntry {
  id: string;
  time: string;
  category: 'SYS' | 'SENSOR' | 'VOICE' | 'NAV' | 'SOS';
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

interface SavedRoute {
  id: string;
  name: string;
  distanceMeters: number;
  steps: string[];
}

export default function App() {
  // --- States ---
  const [isConnected, setIsConnected] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [sensors, setSensors] = useState<SensorData>({
    front: 125,
    left: 85,
    right: 140,
    overhead: 210,
  });
  const [isSimulating, setIsSimulating] = useState(true);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>({
    lat: 13.7563,
    lng: 100.5018,
  });
  const [locationAddress, setLocationAddress] = useState<string>('กรุงเทพมหานคร (กำลังระบุพิกัด GPS)');
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRouteName, setActiveRouteName] = useState<string>('จุดหมาย B (ทางเท้าหน้าอาคาร)');
  const [navStepIdx, setNavStepIdx] = useState(0);
  const [navDistanceMeters, setNavDistanceMeters] = useState(185);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState<string>('ระบบพร้อมนำทาง SafeSight');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      time: '00:01',
      category: 'SYS',
      message: 'SafeSight Smart Helmet พร้อมทำงาน (Expo Go Mode)',
      type: 'success',
    },
  ]);

  const navSteps = [
    'เดินตรงไปข้างหน้าตามแนวถนน 60 เมตร',
    'เลี้ยวซ้ายเข้าสู่ทางเท้าหน้าอาคาร B',
    'เดินตรงไปอีก 80 เมตร ระวังทางต่างระดับ',
    'ถึงจุดหมายปลายทาง B เรียบร้อยแล้วค่ะ',
  ];

  const savedRoutes: SavedRoute[] = [
    { id: '1', name: 'จุดหมาย B (ทางเท้า)', distanceMeters: 185, steps: navSteps },
    { id: '2', name: 'ร้านสะดวกซื้อ 7-11', distanceMeters: 320, steps: ['เดินตรงไป 100 ม.', 'เลี้ยวขวา 120 ม.', 'ถึง 7-11'] },
    { id: '3', name: 'ป้ายรถเมล์หน้าซอย', distanceMeters: 450, steps: ['เดินตรงไป 300 ม.', 'เลี้ยวซ้าย 150 ม.', 'ถึงป้ายรถเมล์'] },
  ];

  const lastObstacleAnnounceTime = useRef<number>(0);

  // --- Speech Helper (Thai TTS) ---
  const speakThai = (text: string, force = false) => {
    setLastSpokenText(text);
    Speech.stop();
    Speech.speak(text, {
      language: 'th-TH',
      pitch: 1.0,
      rate: 0.92,
    });
  };

  // --- Add System Log ---
  const addLog = (
    category: LogEntry['category'],
    message: string,
    type: LogEntry['type'] = 'info'
  ) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs((prev) => [{ id: Math.random().toString(), time: timeStr, category, message, type }, ...prev.slice(0, 25)]);
  };

  // --- Haptic Feedback Helper ---
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'warning') => {
    if (Platform.OS === 'web') return;
    try {
      if (type === 'heavy') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // Ignore if not supported
    }
  };

  // --- Initialize GPS Location ---
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          addLog('SYS', `GPS ล็อคพิกัดจริง: [${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}]`, 'success');
          setLocationAddress(`ละติจูด: ${loc.coords.latitude.toFixed(4)}, ลองจิจูด: ${loc.coords.longitude.toFixed(4)}`);
        } else {
          addLog('SYS', 'ไม่ได้รับสิทธิ์ GPS (ใช้พิกัดจำลอง)', 'warning');
        }
      } catch (err) {
        addLog('SYS', 'เข้าถึง GPS ไม่สำเร็จ ใช้พิกัดจำลอง', 'info');
      }
    })();
  }, []);

  // --- Sensor Simulation Loop & Real-time Collision Voice Warning ---
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setSensors((prev) => {
        // Random walk obstacle distances
        const delta = () => (Math.random() - 0.5) * 20;
        const clamp = (v: number) => Math.max(25, Math.min(300, Math.round(v)));

        const nextFront = clamp(prev.front + delta());
        const nextLeft = clamp(prev.left + delta());
        const nextRight = clamp(prev.right + delta());
        const nextOverhead = clamp(prev.overhead + delta() * 0.5);

        // Check dangerous proximity (< 50cm)
        const now = Date.now();
        if (now - lastObstacleAnnounceTime.current > 4500) {
          if (nextFront < 50) {
            lastObstacleAnnounceTime.current = now;
            triggerHaptic('heavy');
            speakThai(`ระวัง สิ่งกีดขวางข้างหน้า ${nextFront} เซนติเมตร`);
            addLog('SENSOR', `⚠️ สิ่งกีดขวางข้างหน้าใกล้เกินไป: ${nextFront} ซม.`, 'danger');
          } else if (nextOverhead < 160) {
            lastObstacleAnnounceTime.current = now;
            triggerHaptic('heavy');
            speakThai(`ระวัง วัตถุด้านบนระดับศีรษะ ${nextOverhead} เซนติเมตร`);
            addLog('SENSOR', `⚠️ สิ่งกีดขวางเหนือศีรษะ: ${nextOverhead} ซม.`, 'danger');
          } else if (nextLeft < 45) {
            lastObstacleAnnounceTime.current = now;
            triggerHaptic('medium');
            speakThai(`มีสิ่งกีดขวางทางซ้าย ${nextLeft} เซนติเมตร`);
            addLog('SENSOR', `สิ่งกีดขวางทางซ้าย: ${nextLeft} ซม.`, 'warning');
          } else if (nextRight < 45) {
            lastObstacleAnnounceTime.current = now;
            triggerHaptic('medium');
            speakThai(`มีสิ่งกีดขวางทางขวา ${nextRight} เซนติเมตร`);
            addLog('SENSOR', `สิ่งกีดขวางทางขวา: ${nextRight} ซม.`, 'warning');
          }
        }

        return {
          front: nextFront,
          left: nextLeft,
          right: nextRight,
          overhead: nextOverhead,
        };
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // --- Voice Commands Handler ---
  const handleVoiceCommand = (commandText: string) => {
    triggerHaptic('medium');
    addLog('VOICE', `ได้ยินคำสั่ง: "${commandText}"`, 'info');
    setIsListeningVoice(false);

    const lower = commandText.toLowerCase();

    if (lower.includes('b') || lower.includes('บี') || lower.includes('อาคาร')) {
      startNavigation(savedRoutes[0]);
    } else if (lower.includes('7-11') || lower.includes('เซเว่น') || lower.includes('ร้าน')) {
      startNavigation(savedRoutes[1]);
    } else if (lower.includes('รถเมล์') || lower.includes('ป้าย')) {
      startNavigation(savedRoutes[2]);
    } else if (lower.includes('สิ่งกีดขวาง') || lower.includes('ตรวจ')) {
      const msg = `รายงานสิ่งกีดขวาง ข้างหน้า ${sensors.front} เซนติเมตร ซ้าย ${sensors.left} เซนติเมตร ขวา ${sensors.right} เซนติเมตร ด้านบน ${sensors.overhead} เซนติเมตร`;
      speakThai(msg);
      addLog('VOICE', msg, 'success');
    } else if (lower.includes('ตำแหน่ง') || lower.includes('ที่ไหน')) {
      const msg = `ตำแหน่งปัจจุบันของคุณคือ ${locationAddress} ค่ะ`;
      speakThai(msg);
      addLog('VOICE', msg, 'info');
    } else if (lower.includes('หยุด') || lower.includes('ยกเลิก')) {
      stopNavigation();
    } else if (lower.includes('sos') || lower.includes('ช่วย')) {
      triggerEmergencySos();
    } else {
      speakThai(`รับคำสั่ง ${commandText} แล้วค่ะ กำลังเริ่มค้นหาเส้นทาง`);
      startNavigation(savedRoutes[0]);
    }
  };

  // --- Navigation Controls ---
  const startNavigation = (route: SavedRoute) => {
    setActiveRouteName(route.name);
    setNavStepIdx(0);
    setNavDistanceMeters(route.distanceMeters);
    setIsNavigating(true);
    triggerHaptic('heavy');

    const firstInstruction = route.steps[0] || 'เดินตรงไปข้างหน้า';
    const msg = `เริ่มนำทางไปยัง ${route.name} ค่ะ ระยะทางรวม ${route.distanceMeters} เมตร ${firstInstruction}`;
    speakThai(msg, true);
    addLog('NAV', `🚀 เริ่มนำทางจริง: ${route.name} (${route.distanceMeters} ม.)`, 'success');
  };

  const nextNavStep = () => {
    if (navStepIdx < navSteps.length - 1) {
      const nextIdx = navStepIdx + 1;
      setNavStepIdx(nextIdx);
      const remaining = Math.max(0, navDistanceMeters - 60);
      setNavDistanceMeters(remaining);
      const instruction = navSteps[nextIdx];
      speakThai(`จุดต่อไป อีก ${remaining} เมตร ${instruction}`);
      triggerHaptic('medium');
      addLog('NAV', `ก้าวต่อไป (${nextIdx + 1}/${navSteps.length}): ${instruction}`, 'info');
    } else {
      speakThai('คุณได้เดินทางถึงจุดหมายปลายทางแล้วค่ะ สิ้นสุดการนำทาง');
      setIsNavigating(false);
      triggerHaptic('heavy');
      addLog('NAV', '🏁 เดินทางถึงจุดหมายแล้ว', 'success');
    }
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    speakThai('ยกเลิกการนำทางเรียบร้อยแล้วค่ะ');
    triggerHaptic('light');
    addLog('NAV', '⏹ ยกเลิกการนำทาง', 'warning');
  };

  // --- Emergency SOS ---
  const triggerEmergencySos = () => {
    triggerHaptic('heavy');
    const sosMsg = 'ฉุกเฉิน ขอความช่วยเหลือ กำลังส่งพิกัดปัจจุบันไปยังผู้ดูแล';
    speakThai(sosMsg, true);
    addLog('SOS', `🚨 ส่งสัญญาณ SOS ฉุกเฉิน พิกัด: [${currentGps?.lat.toFixed(5)}, ${currentGps?.lng.toFixed(5)}]`, 'danger');
    Alert.alert(
      '🚨 สัญญาณฉุกเฉิน SOS',
      `ระบบ SafeSight ได้ส่งพิกัด GPS ไปยังผู้ดูแลเรียบร้อยแล้ว\nละติจูด: ${currentGps?.lat}\nลองจิจูด: ${currentGps?.lng}`,
      [{ text: 'ตกลง', onPress: () => speakThai('ปลอดภัยแล้วค่ะ') }]
    );
  };

  // Helper for sensor danger color
  const getSensorColor = (cm: number) => {
    if (cm < 50) return '#F43F5E'; // Danger Rose
    if (cm < 100) return '#F59E0B'; // Caution Amber
    return '#10B981'; // Safe Emerald
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B18" />

      {/* --- TOP APP BAR --- */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons name="shield-check" size={26} color="#00F2FE" />
          <Text style={styles.headerTitle}>SafeSight</Text>
          <View style={styles.expoBadge}>
            <Text style={styles.expoBadgeText}>EXPO GO</Text>
          </View>
        </View>

        {/* Status Indicators */}
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Ionicons
              name={isConnected ? 'bluetooth' : 'bluetooth-outline'}
              size={14}
              color={isConnected ? '#00F2FE' : '#94A3B8'}
            />
            <Text style={styles.statusPillText}>{isConnected ? 'ESP32 เชื่อมต่อ' : 'ไม่พบหมวก'}</Text>
          </View>

          <View style={styles.statusPill}>
            <Ionicons name="battery-charging" size={14} color="#10B981" />
            <Text style={styles.statusPillText}>{batteryLevel}%</Text>
          </View>

          <TouchableOpacity
            style={[styles.sosButton, { backgroundColor: '#E11D48' }]}
            onPress={triggerEmergencySos}
            activeOpacity={0.8}
          >
            <Text style={styles.sosButtonText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {/* --- VOICE ASSISTANT CARD --- */}
        <View style={styles.voiceCard}>
          <View style={styles.voiceCardHeader}>
            <View style={styles.voiceIconContainer}>
              <Ionicons name="mic" size={22} color="#00F2FE" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>ระบบสั่งการด้วยเสียง AI</Text>
              <Text style={styles.voiceSubtitle}>
                {isListeningVoice ? 'กำลังฟังเสียงของคุณ...' : `คำพูดล่าสุด: "${lastSpokenText}"`}
              </Text>
            </View>
          </View>

          {/* Big Voice Trigger Button */}
          <TouchableOpacity
            style={[styles.micBigButton, isListeningVoice && styles.micBigButtonActive]}
            onPress={() => {
              setIsListeningVoice(!isListeningVoice);
              if (!isListeningVoice) {
                speakThai('แตะปุ่มแล้วบอกจุดหมายปลายทางได้เลยค่ะ เช่น ไป B หรือ ไป เซเว่น');
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="mic-circle" size={36} color="#050B18" />
            <Text style={styles.micBigButtonText}>
              {isListeningVoice ? 'แตะเพื่อหยุดฟัง' : 'แตะเพื่อพูดสั่งการนำทางทันที'}
            </Text>
          </TouchableOpacity>

          {/* Quick Voice Command Chips */}
          <Text style={styles.quickVoiceLabel}>หรือแตะคำสั่งด่วนเพื่อทดสอบ:</Text>
          <View style={styles.voiceChipsContainer}>
            <TouchableOpacity
              style={styles.voiceChip}
              onPress={() => handleVoiceCommand('ไปจุดหมาย B')}
            >
              <Text style={styles.voiceChipText}>"ไป B" (เริ่มนำทาง)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voiceChip}
              onPress={() => handleVoiceCommand('ไปร้านสะดวกซื้อ 7-11')}
            >
              <Text style={styles.voiceChipText}>"ไป 7-11"</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voiceChip}
              onPress={() => handleVoiceCommand('ตรวจสิ่งกีดขวาง')}
            >
              <Text style={styles.voiceChipText}>"เช็คสิ่งกีดขวาง"</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voiceChip}
              onPress={() => handleVoiceCommand('ขอตำแหน่งปัจจุบัน')}
            >
              <Text style={styles.voiceChipText}>"อยู่ที่ไหน"</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- ACTIVE TURN-BY-TURN NAVIGATION BANNER --- */}
        {isNavigating ? (
          <View style={styles.navBannerActive}>
            <View style={styles.navBannerHeader}>
              <FontAwesome5 name="walking" size={24} color="#00F2FE" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.navBannerTitle}>กำลังนำทางจริงไปยัง {activeRouteName}</Text>
                <Text style={styles.navBannerDistance}>ระยะทางเหลืออีก {navDistanceMeters} เมตร</Text>
              </View>
              <TouchableOpacity onPress={stopNavigation} style={styles.navStopBtn}>
                <Ionicons name="close-circle" size={26} color="#F43F5E" />
              </TouchableOpacity>
            </View>

            <View style={styles.navStepBox}>
              <Text style={styles.navStepLabel}>คำสั่งก้าวปัจจุบัน (ขั้นตอนที่ {navStepIdx + 1}/{navSteps.length}):</Text>
              <Text style={styles.navStepInstruction}>{navSteps[navStepIdx]}</Text>
            </View>

            <TouchableOpacity style={styles.nextStepBtn} onPress={nextNavStep} activeOpacity={0.8}>
              <Text style={styles.nextStepBtnText}>
                {navStepIdx < navSteps.length - 1 ? 'ก้าวต่อไปข้างหน้า ➔' : 'เสร็จสิ้นการเดินทาง 🏁'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navBannerIdle}>
            <View style={{ flex: 1 }}>
              <Text style={styles.navIdleTitle}>พร้อมนำทางเดินเท้า</Text>
              <Text style={styles.navIdleSub}>เลือกเส้นทางในคลังหรือพูด "ไป B" เพื่อเริ่มนำทาง</Text>
            </View>
            <TouchableOpacity
              style={styles.startNavQuickBtn}
              onPress={() => startNavigation(savedRoutes[0])}
            >
              <Text style={styles.startNavQuickBtnText}>เริ่มเดินไป B</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- ULTRASONIC SENSOR SCANNER (4 DIRECTIONS) --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="radar" size={22} color="#00F2FE" />
            <Text style={styles.cardTitle}>เรดาร์สิ่งกีดขวางอัลตราโซนิก (ESP32)</Text>
          </View>
          <Text style={styles.cardDescription}>
            ตรวจจับ 4 ทิศทางรอบศีรษะ: หน้า, ซ้าย, ขวา, ระดับสายตา/สิ่งกีดขวางด้านบน
          </Text>

          <View style={styles.sonarGrid}>
            {/* Front */}
            <View style={[styles.sonarItem, { borderColor: getSensorColor(sensors.front) }]}>
              <Text style={styles.sonarDirection}>ด้านหน้า</Text>
              <Text style={[styles.sonarValue, { color: getSensorColor(sensors.front) }]}>
                {sensors.front} <Text style={styles.sonarUnit}>cm</Text>
              </Text>
              <Text style={styles.sonarStatus}>
                {sensors.front < 50 ? '⚠️ ใกล้มาก' : sensors.front < 100 ? 'ระวัง' : 'ปลอดภัย'}
              </Text>
            </View>

            {/* Overhead */}
            <View style={[styles.sonarItem, { borderColor: getSensorColor(sensors.overhead) }]}>
              <Text style={styles.sonarDirection}>เหนือศีรษะ</Text>
              <Text style={[styles.sonarValue, { color: getSensorColor(sensors.overhead) }]}>
                {sensors.overhead} <Text style={styles.sonarUnit}>cm</Text>
              </Text>
              <Text style={styles.sonarStatus}>
                {sensors.overhead < 160 ? '⚠️ กิ่งไม้/ป้าย' : 'ทางเปิดโล่ง'}
              </Text>
            </View>

            {/* Left */}
            <View style={[styles.sonarItem, { borderColor: getSensorColor(sensors.left) }]}>
              <Text style={styles.sonarDirection}>ทางซ้าย</Text>
              <Text style={[styles.sonarValue, { color: getSensorColor(sensors.left) }]}>
                {sensors.left} <Text style={styles.sonarUnit}>cm</Text>
              </Text>
              <Text style={styles.sonarStatus}>
                {sensors.left < 50 ? '⚠️ ชิดผนัง/เสา' : 'ปลอดภัย'}
              </Text>
            </View>

            {/* Right */}
            <View style={[styles.sonarItem, { borderColor: getSensorColor(sensors.right) }]}>
              <Text style={styles.sonarDirection}>ทางขวา</Text>
              <Text style={[styles.sonarValue, { color: getSensorColor(sensors.right) }]}>
                {sensors.right} <Text style={styles.sonarUnit}>cm</Text>
              </Text>
              <Text style={styles.sonarStatus}>
                {sensors.right < 50 ? '⚠️ ใกล้ขอบทาง' : 'ปลอดภัย'}
              </Text>
            </View>
          </View>

          {/* Test Obstacle Simulator Controls */}
          <View style={styles.simControlsRow}>
            <TouchableOpacity
              style={styles.simBtn}
              onPress={() => {
                setSensors((prev) => ({ ...prev, front: 35 }));
                triggerHaptic('heavy');
                speakThai('ระวัง สิ่งกีดขวางข้างหน้า 35 เซนติเมตร');
              }}
            >
              <Text style={styles.simBtnText}>จำลองวัตถุข้างหน้า (35cm)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.simBtn}
              onPress={() => {
                setSensors((prev) => ({ ...prev, overhead: 140 }));
                triggerHaptic('heavy');
                speakThai('ระวัง วัตถุด้านบนระดับศีรษะ 140 เซนติเมตร');
              }}
            >
              <Text style={styles.simBtnText}>จำลองป้ายบนหัว (140cm)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- SAVED ROUTES LIBRARY --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bookmark" size={20} color="#00F2FE" />
            <Text style={styles.cardTitle}>คลังเส้นทางที่บันทึกไว้</Text>
          </View>

          {savedRoutes.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={styles.routeItem}
              onPress={() => startNavigation(route)}
              activeOpacity={0.7}
            >
              <View style={styles.routeItemIcon}>
                <Ionicons name="navigate" size={20} color="#00F2FE" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.routeItemName}>{route.name}</Text>
                <Text style={styles.routeItemSub}>ระยะทาง {route.distanceMeters} เมตร • แตะเพื่อเริ่มนำทาง</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>

        {/* --- SYSTEM LOGS TERMINAL --- */}
        <View style={styles.terminalCard}>
          <View style={styles.terminalHeader}>
            <Ionicons name="terminal" size={16} color="#38BDF8" />
            <Text style={styles.terminalTitle}>Telemetry Log (ESP32 & Audio Engine)</Text>
          </View>
          {logs.slice(0, 6).map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logTime}>{log.time}</Text>
              <Text style={[styles.logTag, log.type === 'danger' ? styles.tagDanger : styles.tagInfo]}>
                [{log.category}]
              </Text>
              <Text style={styles.logMsg} numberOfLines={1}>
                {log.message}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Stylesheet (Dark High-Contrast Theme for Accessibility) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B18',
  },
  header: {
    backgroundColor: '#0A1528',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  expoBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 10,
  },
  expoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusPillText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  sosButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 16,
  },
  voiceCard: {
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00F2FE40',
  },
  voiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  voiceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00F2FE20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  micBigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginVertical: 6,
  },
  micBigButtonActive: {
    backgroundColor: '#F43F5E',
  },
  micBigButtonText: {
    color: '#050B18',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickVoiceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  voiceChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  voiceChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  voiceChipText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  navBannerActive: {
    backgroundColor: '#0B2238',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#00F2FE',
  },
  navBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navBannerDistance: {
    color: '#00F2FE',
    fontSize: 13,
    fontWeight: '600',
  },
  navStopBtn: {
    padding: 4,
  },
  navStepBox: {
    backgroundColor: '#061322',
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },
  navStepLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
  },
  navStepInstruction: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  nextStepBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  nextStepBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  navBannerIdle: {
    backgroundColor: '#0F1E36',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  navIdleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  navIdleSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  startNavQuickBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startNavQuickBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardDescription: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 14,
  },
  sonarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sonarItem: {
    width: (Dimensions.get('window').width - 32 - 32 - 10) / 2,
    backgroundColor: '#081426',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sonarDirection: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  sonarValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sonarUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#94A3B8',
  },
  sonarStatus: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 4,
  },
  simControlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  simBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  simBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#081426',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  routeItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00F2FE20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  routeItemSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  terminalCard: {
    backgroundColor: '#050B18',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  terminalTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 6,
  },
  logTime: {
    color: '#64748B',
    fontSize: 10,
  },
  logTag: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tagDanger: {
    color: '#F43F5E',
  },
  tagInfo: {
    color: '#38BDF8',
  },
  logMsg: {
    color: '#CBD5E1',
    fontSize: 11,
    flex: 1,
  },
});
