jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from '../src/lib/supabase';
import { getConsentAccess, setConsentAccess } from '../src/consents/access';
import { configureS1RpcTransport } from '../src/lib/consents';
import { configureFoodProfileTransport } from '../src/lib/foodProfile';
import { fetchMyProfile } from '../src/lib/profile';
import { isolatedCapabilityStorage } from './fixtures/s1';
import { signupFoodOptions } from '../src/screens/food/signupFoodOptions';

const catalog = { contract_version: 2, catalog_version: 'v1', capabilities: { food_v2: true, health_storage_v2: true, health_filter: false, automatic_midpoint: false, recommendation_purposes: ['places'] }, food_groups: [] as unknown[], health_groups: [] as unknown[] };
for (const group_code of ['cuisine','preferred_ingredient','food_form','spice','allergy','avoided_food','diet_type','additional_avoid']) {
  const health = ['allergy','avoided_food','diet_type','additional_avoid'].includes(group_code);
  catalog[health ? 'health_groups' : 'food_groups'].push({ group_code, selection: ['spice','diet_type'].includes(group_code) ? 'single' : 'multiple', min: 0, max: 17, sentinel: null, options: signupFoodOptions.filter(o => o.group === group_code).map(o => ({ ...o, enabled: o.code !== 'other_input' })) });
}
beforeEach(() => {
  setConsentAccess('self', 'accepted'); configureS1RpcTransport(undefined, isolatedCapabilityStorage());
  (supabase.from as jest.Mock).mockImplementation(table => {
    const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(async () => ({ error: null, data: table === 'profiles' ? {id:'self',name:'나',tag:'test',avatar_color:'#FF9900',avatar_url:null} : {bank_name:null,account_number:null,birth_date:null,personal_data:{},privacy_settings:{},start_location_name:null,start_latitude:null,start_longitude:null} })) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); return chain;
  });
});
afterEach(() => { configureFoodProfileTransport(); configureS1RpcTransport(); setConsentAccess(null, 'loading'); });
it.each(['PGRST202','42883'])('hides an unavailable v2 editor without querying v1 or closing the gate (%s)', async code => {
  const old = jest.fn(async () => ({data:null,error:{code:'S1008'}}));
  configureS1RpcTransport(old); configureFoodProfileTransport(async () => ({data:null,error:{code}}));
  const result = await fetchMyProfile('self'); expect(result.error).toBeNull();
  expect(result.data?.privateProfile).toMatchObject({foodProfileAvailable:false,foodProfileCompleted:false,tastes:{}});
  expect(old).not.toHaveBeenCalled();expect(getConsentAccess()).toEqual({userId:'self',state:'accepted'});
});
it('uses v2 explicit completion and never calls the old reader after migration', async () => {
  const old = jest.fn(); configureS1RpcTransport(old);
  configureFoodProfileTransport(async name => ({ error:null, data:name==='get_food_profile_catalog_v2'?catalog:{contract_version:2,schema_version:2,catalog_version:'v1',requires_update:false,preferences:{cuisines:['any'],ingredients:[],forms:[],spice:null},revision:'3',completed_at:'2026-10-18T00:00:00Z',onboarding:{seen_at:null,snoozed_until:null}} }));
  const result = await fetchMyProfile('self'); expect(result.error).toBeNull(); expect(result.data?.privateProfile).toMatchObject({foodProfileAvailable:true,foodProfileCompleted:true,tastes:{}}); expect(old).not.toHaveBeenCalled();
});
it('does not silently downgrade an S5 permission failure to the old API', async () => {
  const old = jest.fn(async()=>({data:null,error:{code:'S1001'}})); configureS1RpcTransport(old); configureFoodProfileTransport(async () => ({data:null,error:{code:'42501'}}));
  const result = await fetchMyProfile('self'); expect(result.data).toBeNull(); expect(result.error).not.toBeNull(); expect(old).not.toHaveBeenCalledWith('get_my_food_preferences', {}); expect(old).toHaveBeenCalledWith('get_my_consent_status', {});
});
