import AsyncStorage from '@react-native-async-storage/async-storage';
const LEGACY_ORIGIN_DRAFT_PREFIX = '@mealchat/schedule-settings-draft/v1/';
/** S5 no longer uses private origins. Delete only obsolete draft keys, without reading coordinate values. */
export async function purgeLegacyScheduleDrafts() {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(LEGACY_ORIGIN_DRAFT_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
