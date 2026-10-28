import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { newConsentRequestId } from '../../consents/contracts';
import { getConsentAccess, hasConsentAccess, subscribeConsentAccess } from '../../consents/access';
import { fetchFoodCatalog, foodProfileErrorMessage, type FoodCatalog } from '../../lib/foodProfile';
import { fetchPublicMeetingAreas, fetchRoomRecommendationSettings, requestRestaurantRecommendation, reusableRestaurantRequestId, setRoomPublicCuisines, setRoomRecommendationArea, validateRecommendation, type PublicMeetingArea, type RestaurantResult, type RoomRecommendationSettings } from '../../lib/placeCandidates';
import type { RecommendationStatus, RestaurantSuggestion } from './VotingSheet';
const settingsKey = (value: RoomRecommendationSettings) => JSON.stringify([value.public_area_id, value.public_cuisines, value.revision]);

/** Screen-scoped. Background results are hidden until server context is rechecked; no session-wide cache. */
export function useRestaurantRecommendations({ roomId, userId, enabled, members }: { roomId: string | null; userId: string | null; enabled: boolean; members: string }) {
  const access = useSyncExternalStore(subscribeConsentAccess, getConsentAccess, getConsentAccess);
  const [settings, setSettings] = useState<RoomRecommendationSettings | null>(null), [areas, setAreas] = useState<PublicMeetingArea[]>([]), [catalog, setCatalog] = useState<FoodCatalog | null>(null);
  const [result, setResult] = useState<RestaurantResult | null>(null), [status, setStatus] = useState<RecommendationStatus>('idle'), [reason, setReason] = useState('');
  const [loadedKey, setLoadedKey] = useState(''), [settingsError, setSettingsError] = useState(''), [available, setAvailable] = useState(true), [saving, setSaving] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const generation = useRef(0), sequence = useRef(0), loadSequence = useRef(0);
  const settingsRef = useRef(settings), resultRef = useRef(result), inFlight = useRef<AbortController | null>(null);
  const scope = JSON.stringify([roomId, userId, members]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const ticket = useRef<{ id: string; owner: string; scope: string; settings: string; expiresAt: number } | null>(null);
  const attempted = useRef(false), savingRef = useRef(false), foregroundRef = useRef(foreground);
  const invalidateResult = useCallback((preserveTicket = false) => {
    inFlight.current?.abort(); inFlight.current = null; sequence.current++;
    if (!preserveTicket) ticket.current = null;
    resultRef.current = null; setResult(null); setStatus('idle'); setReason('');
  }, []);
  const clear = useCallback((preserveTicket = false) => {
    generation.current++; loadSequence.current++;
    const keep = preserveTicket && ticket.current?.scope === scopeRef.current && ticket.current.expiresAt > Date.now() && hasConsentAccess(ticket.current.owner);
    invalidateResult(keep); settingsRef.current = null; attempted.current = false;
  }, [invalidateResult]);
  const request = useCallback(async () => {
    if (!enabled || !foregroundRef.current || !roomId || !userId || !settingsRef.current?.area || savingRef.current || !hasConsentAccess(userId) || inFlight.current) return;
    const token = generation.current, id = ++sequence.current, controller = new AbortController(); inFlight.current = controller; attempted.current = true;
    const context = settingsKey(settingsRef.current);
    if (!ticket.current || ticket.current.scope !== scopeRef.current || ticket.current.settings !== context || ticket.current.expiresAt <= Date.now()) {
      ticket.current = { id: newConsentRequestId(), owner: userId, scope: scopeRef.current, settings: context, expiresAt: Date.now() + 5 * 60000 };
    }
    const requestTicket = ticket.current;
    resultRef.current = null; setResult(null); setStatus('loading'); setReason('');
    try {
      const data = await requestRestaurantRecommendation(roomId, undefined, requestTicket.id, controller.signal);
      if (generation.current !== token || sequence.current !== id) return;
      ticket.current = null; resultRef.current = data; setResult(data); setStatus(data.places_status === 'empty' ? 'empty' : 'ready');
      if (data.places_status === 'empty') setReason('공용 만남 지역 근처에서 찾은 곳이 없어요. 식당을 직접 추가해 주세요.');
    } catch (error) {
      if (generation.current === token && sequence.current === id) {
        if (!reusableRestaurantRequestId(error)) ticket.current = null;
        setStatus((error as { code?: string })?.code === 'ABORTED' ? 'idle' : 'error');
        setReason((error as { code?: string })?.code === 'ABORTED' ? '추천을 중단했어요. 다시 추천받기를 누르면 이어서 확인해요.' : foodProfileErrorMessage(error));
      }
    } finally { if (inFlight.current === controller) inFlight.current = null; }
  }, [enabled, roomId, userId]);
  const load = useCallback(async (auto: boolean) => {
    if (!enabled || !foregroundRef.current || !roomId || !userId || !hasConsentAccess(userId)) return;
    const token = generation.current, id = ++loadSequence.current; setLoadedKey(''); setSettingsError('');
    const [s, a, c] = await Promise.all([fetchRoomRecommendationSettings(roomId), fetchPublicMeetingAreas(), fetchFoodCatalog()]);
    if (generation.current !== token || loadSequence.current !== id || !hasConsentAccess(userId)) return;
    if (!s.data || !a.data || !c.data) { invalidateResult(); setAvailable(((s.error ?? a.error ?? c.error) as { code?: string })?.code !== 'S5_UNAVAILABLE'); setSettingsError(foodProfileErrorMessage(s.error ?? a.error ?? c.error)); setStatus('unavailable'); return; }
    const changed = settingsRef.current && (settingsRef.current.revision !== s.data.revision || settingsRef.current.public_area_id !== s.data.public_area_id);
    if (ticket.current && ticket.current.settings !== settingsKey(s.data)) ticket.current = null;
    if (changed) invalidateResult();
    const cached = resultRef.current;
    if (cached) {
      // Reuse only after a cheap context check, never a new provider ticket on foreground.
      const validity = Date.parse(cached.valid_until) > Date.now() ? await validateRecommendation(cached.request_id) : { data: null, error: { code: 'S5004' } };
      if (generation.current !== token || loadSequence.current !== id || !hasConsentAccess(userId)) return;
      if (validity.error || !validity.data) { invalidateResult(); setStatus('error'); setReason(foodProfileErrorMessage(validity.error)); }
    }
    settingsRef.current = s.data; setSettings(s.data); setAreas(a.data); setCatalog(c.data); setAvailable(true); setLoadedKey(userId + ':' + roomId);
    if (!s.data.area) { setStatus('unavailable'); setReason('방장이 공용 만남 지역을 골라 주세요. 식당을 직접 추가할 수도 있어요.'); }
    else if (auto && !attempted.current) void request();
    else if (changed) setReason('추천 조건이 바뀌었어요. 다시 추천받기를 눌러 주세요.');
  }, [enabled, roomId, userId, request, invalidateResult]);
  useEffect(() => {
    clear(true); savingRef.current = false; setSaving(false); setLoadedKey(''); setSettings(null); setAreas([]); setCatalog(null); setSettingsError(''); setAvailable(true);
    void load(true); return () => clear(true);
  }, [roomId, userId, enabled, members, clear, load]);
  const lastAccess = useRef(access);
  useEffect(() => {
    if (lastAccess.current === access) return; lastAccess.current = access;
    if (access.userId !== userId || access.state === 'required' || access.state === 'error') { clear(); setLoadedKey(''); return; }
    if (access.state === 'loading') { inFlight.current?.abort(); setLoadedKey(''); }
    else void load(!attempted.current);
  }, [access, userId, clear, load]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const wasActive = foregroundRef.current; foregroundRef.current = state === 'active'; setForeground(state === 'active');
      if (state !== 'active') { inFlight.current?.abort(); setLoadedKey(''); }
      else if (!wasActive) void load(!attempted.current);
    });
    return () => subscription.remove();
  }, [load]);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => { resultRef.current = null; setResult(null); setStatus('error'); setReason('추천 유효 시간이 지났어요. 다시 추천받아 주세요.'); }, Math.max(0, Date.parse(result.valid_until) - Date.now()));
    return () => clearTimeout(timer);
  }, [result]);
  const save = async (kind: 'area' | 'cuisines', value: string | string[]) => {
    if (!roomId || !settingsRef.current || savingRef.current) return; const token = generation.current;
    savingRef.current = true; setSaving(true); setSettingsError('');
    const response = kind === 'area' ? await setRoomRecommendationArea(roomId, value as string, settingsRef.current.revision) : await setRoomPublicCuisines(roomId, value as string[], settingsRef.current.revision);
    if (generation.current !== token) return;
    savingRef.current = false; setSaving(false);
    if (!response.data) {
      const message = foodProfileErrorMessage(response.error);
      if ((response.error as { code?: string } | null)?.code === 'S1004') await load(false);
      if (generation.current === token) setSettingsError(message);
    } else { invalidateResult(); settingsRef.current = response.data; setSettings(response.data); if (kind === 'area') void request(); else setReason('음식 종류를 바꿨어요. 다시 추천받기를 눌러 주세요.'); }
  };
  const validateSuggestion = async (label: string) => {
    const data = resultRef.current, token = generation.current;
    if (!foregroundRef.current || !data || Date.parse(data.valid_until) <= Date.now() || !data.place_recommendations.some(p => p.place.name === label)) throw Object.assign(Error('추천 유효 시간이 지났어요. 다시 추천받아 주세요.'), { code: 'S5004' });
    const response = await validateRecommendation(data.request_id);
    if (response.error || generation.current !== token || resultRef.current !== data) { invalidateResult(); setStatus('error'); setReason(foodProfileErrorMessage(response.error)); throw response.error ?? Error('추천 조건이 바뀌었어요.'); }
  };
  const validScope = enabled && foreground && hasConsentAccess(userId) && loadedKey === userId + ':' + roomId;
  const suggestions: RestaurantSuggestion[] = (validScope ? result : null)?.place_recommendations.map(p => ({ label: p.place.name, source: result!.source, fresh: false })) ?? [];
  return { settings: validScope ? settings : null, areas: validScope ? areas : [], catalog: validScope ? catalog : null, status: validScope ? status : 'unavailable' as const, reason: validScope ? reason : '', suggestions, settingsError, available, saving, request, validateSuggestion, saveArea: (id: string) => save('area', id), saveCuisines: (codes: string[]) => save('cuisines', codes), reload: () => void load(false) };
}
