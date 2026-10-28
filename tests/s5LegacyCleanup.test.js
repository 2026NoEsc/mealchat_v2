const React=require('react');
const {act,create}=require('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage',()=>({getAllKeys:jest.fn(),multiRemove:jest.fn(),getItem:jest.fn(async()=>null),setItem:jest.fn(),removeItem:jest.fn()}));
jest.mock('expo-linking',()=>({getInitialURL:jest.fn(async()=>null),addEventListener:jest.fn(()=>({remove:jest.fn()})),createURL:path=>path}));
jest.mock('../src/lib/supabase',()=>({supabase:{auth:{getSession:jest.fn(async()=>({data:{session:null}})),onAuthStateChange:jest.fn(()=>({data:{subscription:{unsubscribe:jest.fn()}}}))}}}));
const storage=require('@react-native-async-storage/async-storage');
const {AuthProvider}=require('../src/auth/AuthProvider');
const {purgeLegacyScheduleDrafts}=require('../src/lib/legacyScheduleCleanup');
beforeEach(()=>{jest.clearAllMocks();storage.getAllKeys.mockResolvedValue(['@mealchat/schedule-settings-draft/v1/A','@mealchat/schedule-settings-draft/v1/B','other/key']);storage.multiRemove.mockResolvedValue();});
it('purges only obsolete origin draft keys during auth startup without reading their values',async()=>{
 let renderer;await act(async()=>{renderer=create(React.createElement(AuthProvider,null));});
 expect(storage.getAllKeys).toHaveBeenCalledTimes(1);expect(storage.multiRemove).toHaveBeenCalledWith(['@mealchat/schedule-settings-draft/v1/A','@mealchat/schedule-settings-draft/v1/B']);
 expect(storage.getItem.mock.calls.flat().some(key=>String(key).startsWith('@mealchat/schedule-settings-draft/v1/'))).toBe(false);
 await act(async()=>renderer.unmount());
});
it('does not delete unrelated keys or issue an empty bulk delete',async()=>{storage.getAllKeys.mockResolvedValueOnce(['auth/preserved','other/key']);await purgeLegacyScheduleDrafts();expect(storage.multiRemove).not.toHaveBeenCalled();});
