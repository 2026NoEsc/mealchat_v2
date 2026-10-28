import type { MealRecord } from '../../src/screens/history/MealHistoryScreen';
const mates = [
  { name: '두두', photo: require('./history-assets/dudu.png') },
  { name: '모아', photo: require('./history-assets/moa.png') },
  { name: '또리', photo: require('./history-assets/ddori.png') },
  { name: '웰링', photo: require('./history-assets/welling.png') },
];
export const records: MealRecord[] = [
  { id: 'preview-lunch', title: '회사 팀 점심', date: '2026-09-27', dateLabel: '9월 27일 (일)', time: '12:30', place: '조선칼국수 하단점', photo: require('./history-assets/korean.jpg'), mates, amount: 52000, share: 13000, settling: true,
    items: [{ name: '조선칼국수 (보통)', quantity: 3, amount: 27000 }, { name: '조선칼국수 (곱빼기)', quantity: 1, amount: 10000 }, { name: '수육', quantity: 1, amount: 13000 }, { name: '공기밥 추가', quantity: 2, amount: 2000 }] },
  { id: 'preview-dinner', title: '오늘 저녁팟', date: '2026-09-25', dateLabel: '9월 25일 (금)', time: '18:30', place: '돼지집 서면점', photo: require('./history-assets/meat.jpg'), mates: mates.slice(0, 3), amount: 48000, share: 16000, items: [] },
  { id: 'preview-brunch', title: '주말 브런치 모임', date: '2026-08-02', dateLabel: '8월 2일 (일)', time: '11:00', place: '카페 모닝글로우', photo: require('./history-assets/brunch.jpg'), mates: mates.slice(0, 2), amount: 25000, share: 12500, items: [] },
  { id: 'preview-study', title: '스터디 후 저녁', date: '2026-07-28', dateLabel: '7월 28일 (화)', time: '18:00', place: '미가당 국밥', photo: require('./history-assets/soup.jpg'), mates: mates.slice(0, 3), amount: 27000, share: 9000, items: [] },
  { id: 'preview-birthday', title: '생일 기념 디너', date: '2026-07-14', dateLabel: '7월 14일 (화)', time: '19:00', place: '더 플레이트', photo: require('./history-assets/dinner.jpg'), mates, amount: 124000, share: 31000, items: [] },
];
