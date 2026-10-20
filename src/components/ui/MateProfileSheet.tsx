import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { addFriend, fetchMyFriends } from '../../lib/friends';
import { formatBirthDate, formatGender } from '../../lib/format';
import { fetchVisibleProfile } from '../../lib/profile';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import Avatar from '../Avatar';

export type MateProfileSheetProps = {
  visible: boolean;
  /** [결정] 멤버 시트 안에서는 기존 모달을 재사용해 iOS 시트가 겹치지 않게 한다. */
  embedded?: boolean;
  profileId: string | null;
  roomId?: string | null;
  myId?: string | null;
  name?: string;
  avatarUrl?: string | null;
  onClose: () => void;
  onEditProfile?: () => void;
};

type VisibleProfileResult = {
  profile: {
    id: string;
    name: string;
    tag: string;
    avatar_color: string;
    avatar_url: string | null;
  };
  relationship: 'self' | 'room_mate' | 'identity_only';
  fields: Record<string, unknown>;
};

/**
 * [결정] Phone 628:2832(메이트 프로필) / 638:12723(본인 프로필).
 * - Figma 기준 생년월일·성별 행만 유지(계좌는 최소 노출 원칙으로 제거).
 * - '함께 먹은 밥약'은 서버 데이터가 없으므로 행을 두지 않음.
 * - 서버가 값을 주지 않은 필드는 Figma 원문대로 "공개 안 함"으로 표시.
 * - relationship === 'self'인 경우 서버가 비공개 필드(bio 등)까지 반환하므로,
 *   정보 행과 bio를 숨기고 '내 프로필 수정' CTA만 제공.
 * - 신고·차단·학과는 서버가 없어 노출하지 않음.
 */
export default function MateProfileSheet({
  visible,
  embedded = false,
  profileId,
  roomId,
  myId,
  name: fallbackName,
  avatarUrl: fallbackAvatarUrl,
  onClose,
  onEditProfile,
}: MateProfileSheetProps) {
  const [profileData, setProfileData] = useState<VisibleProfileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [friendChecking, setFriendChecking] = useState(true);
  const [friendCheckFailed, setFriendCheckFailed] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const isSelf = Boolean(myId && profileId === myId) || profileData?.relationship === 'self';

  const loadData = useCallback(() => {
    cleanupRef.current?.();
    if (!profileId) {
      setLoading(false);
      setFriendChecking(false);
      return () => {};
    }

    let active = true;
    setLoading(true);
    setFetchError(null);

    void (async () => {
      try {
        const { data, error } = await fetchVisibleProfile(profileId, roomId ?? null);
        if (!active) return;
        if (error || !data) {
          setFetchError('프로필 정보를 불러오지 못했어요.');
        } else {
          setProfileData(data as VisibleProfileResult);
        }
      } catch {
        if (active) setFetchError('프로필 정보를 불러오지 못했어요.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    if (myId && profileId !== myId) {
      setFriendChecking(true);
      setFriendCheckFailed(false);
      void (async () => {
        try {
          const { data: friends, error } = await fetchMyFriends(myId);
          if (!active) return;
          if (error) {
            setFriendCheckFailed(true);
          } else if (friends?.some((f) => f.profileId === profileId)) {
            setIsFriend(true);
          }
        } catch {
          if (active) setFriendCheckFailed(true);
        } finally {
          if (active) setFriendChecking(false);
        }
      })();
    } else {
      setFriendChecking(false);
    }

    const cleanup = () => {
      active = false;
    };
    cleanupRef.current = cleanup;
    return cleanup;
  }, [profileId, roomId, myId]);

  useEffect(() => {
    if (!visible) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setProfileData(null);
      setIsFriend(false);
      setFriendError(null);
      setFetchError(null);
      setFriendCheckFailed(false);
      setLoading(true);
      setFriendChecking(true);
      return;
    }
    const cleanup = loadData();
    return () => {
      cleanup?.();
      cleanupRef.current = null;
    };
  }, [visible, loadData]);

  if (!visible) return null;

  const displayName = profileData?.profile.name ?? fallbackName ?? '메이트';
  const displayAvatarUrl = profileData?.profile.avatar_url ?? fallbackAvatarUrl ?? null;
  const displaySeed = profileData?.profile.id ?? profileId ?? 'mate';
  const fields = profileData?.fields ?? {};

  const bio = typeof fields.bio === 'string' && fields.bio.trim() ? fields.bio.trim() : null;
  const rawBirthdate = typeof fields.birthdate === 'string' ? fields.birthdate : null;
  const birthdateLabel = rawBirthdate ? (formatBirthDate(rawBirthdate) ?? rawBirthdate) : '공개 안 함';
  const genderLabel = fields.gender != null ? (formatGender(fields.gender) ?? '공개 안 함') : '공개 안 함';

  const handleAddFriend = async () => {
    if (!myId || !profileId || addingFriend || isFriend || friendChecking) return;
    setAddingFriend(true);
    setFriendError(null);
    try {
      const error = await addFriend(myId, profileId);
      if (error) {
        const errorMsg = String((error as { message?: string }).message || error);
        const errorCode = String((error as { code?: string }).code || '');
        // [결정] 이미 친구인 경우(중복 코드 23505) 이미 친구 상태로 전환
        if (errorCode === '23505' || errorMsg.includes('23505') || errorMsg.includes('duplicate')) {
          setIsFriend(true);
        } else {
          setFriendError('친구를 추가하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      } else {
        setIsFriend(true);
      }
    } catch {
      setFriendError('친구를 추가하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleEditProfile = () => {
    onClose();
    onEditProfile?.();
  };

  const content = (
    <View style={[styles.sheet, embedded && styles.embedded]} testID="mate-profile-sheet">
      {!embedded ? <View style={styles.handle} /> : null}

      <View style={styles.head}>
        <Avatar
          name={displayName}
          url={displayAvatarUrl}
          seed={displaySeed}
          size={64}
          radius={32}
        />
        <View style={styles.titleBox}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}{isSelf ? ' (나)' : ''}
          </Text>
          {/* [결정] self에게는 서버가 비공개 bio까지 반환하므로 self일 때 bio를 숨김 */}
          {!isSelf && bio ? (
            <Text style={styles.bio} numberOfLines={1}>
              {`"${bio}"`}
            </Text>
          ) : profileData?.profile.tag ? (
            <Text style={styles.tag} numberOfLines={1}>
              @{profileData.profile.tag}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={styles.closeButton}
          onPress={onClose}
        >
          <X size={20} color={colors.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : fetchError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            style={styles.retryButton}
            onPress={() => void loadData()}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* [결정] self에서는 비공개 값 누출을 방지하기 위해 정보 행을 숨기고 '내 프로필 수정' CTA만 제공.
              identity_only는 방 참여자가 아니므로 정보 카드를 표시하지 않음 */}
          {!isSelf && profileData?.relationship !== 'identity_only' ? (
            <>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>생년월일</Text>
                  <Text style={[styles.infoValue, birthdateLabel === '공개 안 함' && styles.unset]}>
                    {birthdateLabel}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>성별</Text>
                  <Text style={[styles.infoValue, genderLabel === '공개 안 함' && styles.unset]}>
                    {genderLabel}
                  </Text>
                </View>
              </View>

              <Text style={styles.subtitle}>
                {`정보 공개 범위는 ${displayName}님이 정해요.`}
              </Text>
            </>
          ) : null}

          {friendError ? (
            <Text accessibilityRole="alert" style={styles.actionErrorText}>
              {friendError}
            </Text>
          ) : null}

          <View style={styles.buttons}>
            {isSelf ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="내 프로필 수정"
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleEditProfile}
              >
                <Text style={styles.buttonText}>내 프로필 수정</Text>
              </Pressable>
            ) : profileId ? (
              friendCheckFailed ? (
                <View style={styles.friendRetryBox}>
                  <Text style={styles.friendErrorText}>친구 상태를 불러오지 못했어요.</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="친구 상태 다시 확인"
                    style={styles.retryButton}
                    onPress={() => void loadData()}
                  >
                    <Text style={styles.retryText}>다시 시도</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isFriend ? '이미 친구' : '친구 추가'}
                  accessibilityState={{ disabled: isFriend || addingFriend || friendChecking }}
                  disabled={isFriend || addingFriend || friendChecking}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.secondaryButton,
                    (isFriend || addingFriend || friendChecking) && styles.disabledButton,
                    pressed && !isFriend && !friendChecking && styles.pressed,
                  ]}
                  onPress={() => void handleAddFriend()}
                >
                  <Text style={styles.buttonText}>
                    {friendChecking ? '확인 중...' : addingFriend ? '추가 중...' : isFriend ? '이미 친구' : '친구 추가'}
                  </Text>
                </Pressable>
              )
            ) : null}
          </View>
        </>
      )}
    </View>
  );
  if (embedded) return content;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="프로필 닫기" style={styles.scrim} onPress={onClose} />
      {content}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  embedded: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ink,
    opacity: 0.5,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginVertical: 4,
  },
  head: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBox: {
    flex: 1,
    paddingLeft: 12,
    gap: 2,
    justifyContent: 'center',
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
  },
  bio: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
  },
  tag: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
  },
  closeButton: {
    width: v3Layout.minTouchTarget,
    height: v3Layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: v3FeedbackColors.error,
  },
  friendRetryBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  friendErrorText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.selectedText,
  },
  infoCard: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
  },
  infoValue: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  unset: {
    fontFamily: fontFamily.body,
    color: colors.sub,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.sub,
  },
  actionErrorText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: v3FeedbackColors.error,
  },
  buttons: {
    width: '100%',
  },
  actionButton: {
    width: '100%',
    minHeight: v3Layout.buttonHeight,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
});
