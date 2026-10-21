-- S1 M7: publish verified documents and switch the required bundle atomically.
-- DEPLOYMENT HOLD: privacy 2nd edition and build-release-date + 7 days are not final.
-- No environment/session/GUC bypass exists. Test tools replace ONLY a disposable copy.
begin;
do $s1_activate$
declare
 -- BEGIN PRIVACY RELEASE CONSTANTS -- the ONLY release-edit block.
 privacy_release constant jsonb := $s1_privacy$
{
  "version": null,
  "edition": 2,
  "effective_from": null,
  "content_hash": null,
  "canonical_content": null
}
$s1_privacy$::jsonb;
 -- END PRIVACY RELEASE CONSTANTS
 documents constant jsonb := $s1_documents$
{
  "service": {
    "version": "service-2026-10-01-v2",
    "edition": 2,
    "content_hash": "81ba373c21fafc5711b47013b32f7e9b37150100d84d49e937711524b38ba0cf",
    "canonical_content": "{\"id\":\"terms\",\"title\":\"서비스 이용약관\",\"effectiveDate\":\"2026년 10월 1일\",\"edition\":2,\"sections\":[{\"id\":\"purpose\",\"title\":\"제1조 (목적)\",\"paragraphs\":[\"이 약관은 NoEsc(이하 \\\"운영자\\\")가 제공하는 MEALCHAT(이하 \\\"서비스\\\")의 이용 조건과 절차, 운영자와 회원의 권리 · 의무를 정합니다.\"]},{\"id\":\"definitions\",\"title\":\"제2조 (용어)\",\"paragraphs\":[\"1. \\\"회원\\\"은 이 약관에 동의하고 계정을 만든 사람입니다.\",\"2. \\\"밥약\\\"은 회원이 메이트와 함께 식사 약속을 정하는 채팅방입니다.\",\"3. \\\"메이트\\\"는 같은 밥약에 참여한 회원이고, \\\"방장\\\"은 밥약을 만든 회원입니다.\",\"4. \\\"정산\\\"은 밥약의 식사 비용을 참여한 메이트 수로 나누어 계산하는 기능입니다.\"]},{\"id\":\"changes\",\"title\":\"제3조 (약관의 게시와 변경)\",\"paragraphs\":[\"1. 운영자는 이 약관을 앱의 설정 화면에 게시합니다.\",\"2. 약관을 바꿀 때는 시행 7일 전부터 앱 안에 알립니다. 회원에게 불리한 변경은 30일 전부터 알리고, 앱을 열 때 다시 동의를 받습니다.\",\"3. 바뀐 약관에 동의하지 않으면 탈퇴할 수 있습니다.\"]},{\"id\":\"account\",\"title\":\"제4조 (회원가입과 계정)\",\"paragraphs\":[\"1. 만 14세 이상만 가입할 수 있습니다.\",\"2. 회원은 이메일로 가입하며, 한 사람이 하나의 계정을 씁니다.\",\"3. 계정을 다른 사람에게 빌려주거나 넘길 수 없고, 비밀번호 관리는 회원의 책임입니다.\"]},{\"id\":\"services\",\"title\":\"제5조 (서비스 내용)\",\"paragraphs\":[\"운영자는 다음 기능을 제공합니다.\",\"1. 일정 조율: 메이트들의 가능한 시간을 모아 약속 시간을 추천합니다.\",\"2. 메뉴 · 식당 정하기: 취향과 투표로 메뉴와 식당을 정하고, AI가 후보를 추천합니다.\",\"3. 채팅: 밥약 안에서 메시지와 이모티콘을 주고받습니다.\",\"4. 정산: 금액을 나누어 계산하고, 송금 앱으로 연결합니다.\",\"5. 밥약 기록: 끝난 밥약의 영수증과 사진을 모아 보여 줍니다.\"]},{\"id\":\"ai\",\"title\":\"제6조 (AI 추천)\",\"paragraphs\":[\"1. 시간 · 메뉴 · 식당 추천은 참고용이며, 운영자는 추천의 정확성이나 식당의 영업 여부를 보장하지 않습니다.\",\"2. 알레르기와 식단 정보는 메뉴의 주재료를 기준으로 걸러 냅니다. 소스 · 반찬 등에 들어간 재료는 확인하지 못할 수 있으니, 주문 전에 식당에 꼭 확인해 주세요.\"]},{\"id\":\"settlement\",\"title\":\"제7조 (정산)\",\"paragraphs\":[\"1. 운영자는 정산 금액을 계산하고 송금 앱을 열어 줄 뿐, 돈을 받거나 보관하거나 보내지 않습니다.\",\"2. 메이트 사이의 송금과 그 결과는 회원 사이의 일이며, 운영자는 송금 실패나 다툼에 책임을 지지 않습니다.\"]},{\"id\":\"duties\",\"title\":\"제8조 (회원의 의무)\",\"paragraphs\":[\"회원은 다음 행동을 해서는 안 됩니다.\",\"1. 다른 사람의 정보를 도용하거나 거짓 정보로 가입하는 일\",\"2. 욕설 · 비하 · 성적인 표현, 스팸 · 광고를 보내는 일\",\"3. 돈을 요구하거나 정산을 이용해 속이는 일\",\"4. 서비스를 해킹하거나 정상 운영을 방해하는 일\"]},{\"id\":\"reports\",\"title\":\"제9조 (신고와 이용 제한)\",\"paragraphs\":[\"1. 회원은 메시지를 길게 눌러 신고하거나 상대를 차단할 수 있습니다.\",\"2. 운영자는 신고를 받으면 24시간 안에 확인하고, 제8조를 어긴 것이 확인되면 메시지를 가리거나 이용을 제한할 수 있습니다.\",\"3. 이용 제한에 이의가 있으면 문의하기로 알려 주세요.\"]},{\"id\":\"posts\",\"title\":\"제10조 (게시물)\",\"paragraphs\":[\"1. 채팅 메시지와 사진의 권리는 작성한 회원에게 있습니다.\",\"2. 운영자는 서비스 제공에 필요한 범위에서만 게시물을 저장 · 표시합니다.\",\"3. 방은 정산이 끝나고 24시간 뒤 사라지며, 그때 방의 채팅도 함께 지워집니다.\"]},{\"id\":\"availability\",\"title\":\"제11조 (서비스의 변경과 중단)\",\"paragraphs\":[\"운영자는 점검이나 장애가 있을 때 서비스를 잠시 멈출 수 있으며, 미리 알릴 수 있는 경우에는 앱 안에 알립니다.\"]},{\"id\":\"withdrawal\",\"title\":\"제12조 (탈퇴)\",\"paragraphs\":[\"1. 회원은 설정 → 계정 삭제에서 언제든 바로 탈퇴할 수 있습니다.\",\"2. 진행 중인 정산이 있거나 방장인 방이 남아 있으면, 정산을 마치거나 방을 없앤 뒤 탈퇴할 수 있습니다.\",\"3. 탈퇴하면 회원 정보는 바로 지워집니다. 자세한 내용은 개인정보 처리방침을 따릅니다.\"]},{\"id\":\"liability\",\"title\":\"제13조 (책임의 제한)\",\"paragraphs\":[\"운영자는 천재지변, 회원의 잘못, 회원 사이의 거래 등 운영자의 고의나 과실이 없는 일로 생긴 손해에는 책임을 지지 않습니다.\"]},{\"id\":\"disputes\",\"title\":\"제14조 (분쟁 해결)\",\"paragraphs\":[\"이 약관은 대한민국 법을 따르며, 분쟁이 생기면 민사소송법에 따른 관할 법원에서 해결합니다.\"]},{\"id\":\"supplement\",\"title\":\"부칙\",\"paragraphs\":[\"이 약관은 2026년 10월 1일부터 시행합니다.\"]}]}\n",
    "effective_from": "2026-09-30T15:00:00Z"
  },
  "health": {
    "version": "health-2026-10-17-v1",
    "edition": 1,
    "content_hash": "7c2e5915f739e86c248e3e6a14ec39b267b11d42a09b0331129abebec28606db",
    "canonical_content": "{\"id\":\"health\",\"title\":\"건강 관련 정보 수집·이용 동의\",\"effectiveDate\":\"2026년 10월 17일\",\"edition\":1,\"sections\":[{\"id\":\"items\",\"title\":\"수집 항목과 이용 목적\",\"paragraphs\":[\"알레르기와 식단 제한 정보를 수집하며, 메뉴 추천에서 맞지 않는 메뉴를 제외하는 데만 사용합니다. 다른 회원에게 공개하지 않습니다.\"]},{\"id\":\"choice\",\"title\":\"선택 동의\",\"paragraphs\":[\"동의하지 않아도 회원가입과 기본 서비스를 이용할 수 있습니다. 건강정보 입력과 이를 이용한 메뉴 제외 기능은 유효한 별도 동의가 있을 때만 사용할 수 있습니다.\"]},{\"id\":\"retention\",\"title\":\"이용·보관 기간\",\"paragraphs\":[\"동의한 시각부터 달력 기준 1년 동안 이용합니다. 만료 시각부터 조회·저장·추천 사용을 즉시 차단하고, 만료된 데이터는 하루 1회 배치에서 삭제합니다. 계속 이용하려면 다시 동의하고 필요한 정보를 새로 입력해야 합니다.\"]},{\"id\":\"withdrawal\",\"title\":\"동의 철회\",\"paragraphs\":[\"설정의 선택 동의에서 언제든 철회할 수 있습니다. 거절하거나 철회하면 상태 변경과 건강정보 삭제를 함께 처리하며, 이후 건강정보를 이용하지 않습니다. 만료 후 다시 동의해도 이전 건강정보를 복구하지 않습니다.\"]}]}\n",
    "effective_from": "2026-10-16T15:00:00Z"
  },
  "marketing": {
    "version": "marketing-2026-10-17-v1",
    "edition": 1,
    "content_hash": "38b7629cfd8b938d7bef763f22659222310251aae06db9702c137f926a9ac1c9",
    "canonical_content": "{\"id\":\"marketing\",\"title\":\"마케팅 정보 수신 동의\",\"effectiveDate\":\"2026년 10월 17일\",\"edition\":1,\"sections\":[{\"id\":\"choice\",\"title\":\"선택 동의\",\"paragraphs\":[\"마케팅 정보 수신은 선택 사항이며, 동의하지 않아도 회원가입과 기본 서비스를 이용할 수 있습니다.\"]},{\"id\":\"status\",\"title\":\"기록과 재확인\",\"paragraphs\":[\"동의 상태와 동의한 시각, 다음 재확인 시점을 기록합니다. 동의한 시각부터 달력 기준 2년마다 동의 여부를 다시 확인합니다. 앱 접속이나 설정 조회만으로 동의 시각과 다음 재확인 시점을 연장하지 않습니다.\"]},{\"id\":\"sending\",\"title\":\"현재 발송 여부\",\"paragraphs\":[\"안내 수단이 마련될 때까지 광고성 발송은 전부 비활성입니다. 현재는 동의 상태를 기록해도 광고성 정보를 발송하지 않습니다.\"]},{\"id\":\"withdrawal\",\"title\":\"동의 철회\",\"paragraphs\":[\"설정의 선택 동의에서 언제든 철회할 수 있습니다. 철회 후에는 광고성 정보를 보내지 않습니다.\"]}]}\n",
    "effective_from": "2026-10-16T15:00:00Z"
  }
}
$s1_documents$::jsonb;
 activation_time timestamptz := clock_timestamp();
 privacy_time timestamptz;
 bundle_version text;
 document_ids jsonb := '{}';
 payload jsonb;
 doc public.consent_documents%rowtype;
 bundle public.terms_versions%rowtype;
 kind_name text;
begin
 -- This check precedes every write/lock. Unconfigured M7 never publishes placeholders.
 if jsonb_typeof(privacy_release->'version') is distinct from 'string'
 or jsonb_typeof(privacy_release->'effective_from') is distinct from 'string'
 or jsonb_typeof(privacy_release->'content_hash') is distinct from 'string'
 or jsonb_typeof(privacy_release->'canonical_content') is distinct from 'string'
 or privacy_release->>'version' ~* 'placeholder|pending|todo|__|미정'
 or privacy_release->>'effective_from' ~* 'placeholder|pending|todo|__|미정'
 or privacy_release->>'content_hash' !~ '^[0-9a-f]{64}$'
 or privacy_release->>'version' !~ '^privacy-.+-v2$'
 or privacy_release->'edition' is distinct from '2'::jsonb then
  raise exception 'S1_ACTIVATION_CONFIGURATION_REQUIRED' using errcode='22023';
 end if;
 begin
  privacy_time := (privacy_release->>'effective_from')::timestamptz;
 exception when others then
  raise exception 'S1_ACTIVATION_INVALID_EFFECTIVE_FROM' using errcode='22023';
 end;
 if not isfinite(privacy_time) then raise exception 'S1_ACTIVATION_INVALID_EFFECTIVE_FROM' using errcode='22023'; end if;
 -- M2 only serves an already effective current bundle. Do not strand users for 7 days.
 if privacy_time>activation_time then raise exception 'S1_ACTIVATION_NOT_EFFECTIVE' using errcode='S1006'; end if;
 if (privacy_time at time zone 'Asia/Seoul')::time <> time '00:00' then
  raise exception 'S1_ACTIVATION_INVALID_EFFECTIVE_FROM' using errcode='22023';
 end if;
 if (privacy_release->>'canonical_content')::jsonb->>'effectiveDate' is distinct from
  to_char(privacy_time at time zone 'Asia/Seoul','YYYY년 FMMM월 FMDD일') then
  raise exception 'S1_ACTIVATION_PRIVACY_DATE_MISMATCH' using errcode='22023';
 end if;
 bundle_version := 'mealchat-'||to_char(privacy_time at time zone 'Asia/Seoul','YYYY-MM-DD')||'-r2';
 -- Legacy projection follows the same profile-first lock order as explicit consent.
 -- Acquire these BEFORE catalog/table locks so a waiting withdrawal cannot deadlock.
 perform 1 from public.profiles p
 where exists(select 1 from public.profile_consents e where e.profile_id=p.id and e.kind='marketing' and e.source='legacy')
 and not exists(select 1 from public.profile_consent_states s where s.profile_id=p.id and s.kind='marketing')
 order by p.id for update;
 -- Serializes publication with other publishers. Ordinary readers see old or new commit.
 lock table public.consent_documents,public.terms_versions in share row exclusive mode;
 foreach kind_name in array array['service','privacy','health','marketing'] loop
  payload := case when kind_name='privacy' then privacy_release else documents->kind_name end;
  if (payload->>'effective_from')::timestamptz>activation_time then
   raise exception 'S1_ACTIVATION_NOT_EFFECTIVE' using errcode='S1006';
  end if;
  insert into public.consent_documents(kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash,change_summary)
  values(kind_name,payload->>'version',(payload->>'edition')::integer,(payload->>'effective_from')::timestamptz,
   activation_time,false,payload->>'canonical_content',payload->>'content_hash','S1 명시적 동의 문서')
  on conflict(kind,version) do nothing;
  select * into doc from public.consent_documents where kind=kind_name and version=payload->>'version';
  -- Never rewrite a version that was already published (or a conflicting draft).
  if (doc.edition,doc.effective_from,doc.canonical_content,doc.content_hash) is distinct from
   ((payload->>'edition')::integer,(payload->>'effective_from')::timestamptz,payload->>'canonical_content',payload->>'content_hash') then
   raise exception 'S1_ACTIVATION_DOCUMENT_CONFLICT' using errcode='22023';
  end if;
  update public.consent_documents set published_at=activation_time where id=doc.id and published_at is null;
  if coalesce(doc.published_at,activation_time)>activation_time then raise exception 'S1_ACTIVATION_NOT_EFFECTIVE' using errcode='S1006'; end if;
  document_ids := document_ids||jsonb_build_object(kind_name,doc.id);
 end loop;
 -- Keep every old 2026-08-17 row/event. No consent event is inserted or upgraded here.
 update public.terms_versions set is_current=false where is_current;
 update public.consent_documents set is_current=false where is_current;
 update public.consent_documents set is_current=true where id in
  (select value::uuid from jsonb_each_text(document_ids));
 insert into public.terms_versions(version,effective_from,is_current,service_document_id,privacy_document_id,published_at,change_summary)
 values(bundle_version,privacy_time,false,(document_ids->>'service')::uuid,(document_ids->>'privacy')::uuid,activation_time,
  '서비스 약관 2판 및 개인정보 처리방침 2판 동의') on conflict(version) do nothing;
 select * into bundle from public.terms_versions where version=bundle_version;
 if (bundle.effective_from,bundle.service_document_id,bundle.privacy_document_id) is distinct from
  (privacy_time,(document_ids->>'service')::uuid,(document_ids->>'privacy')::uuid) then
  raise exception 'S1_ACTIVATION_BUNDLE_CONFLICT' using errcode='22023';
 end if;
 if bundle.published_at>activation_time then raise exception 'S1_ACTIVATION_NOT_EFFECTIVE' using errcode='S1006'; end if;
 update public.terms_versions set published_at=coalesce(published_at,activation_time),is_current=true where id=bundle.id;
 -- Complete legacy marketing projection only when no newer state exists.
 -- Its document_id stays legacy/null: this does NOT imply assent to the new document.
 insert into public.profile_consent_states(profile_id,kind,status,document_id,latest_event_id,granted_event_id,granted_at,next_confirmation_at,revision)
 select e.profile_id,e.kind,case e.action when 'grant' then 'granted' when 'decline' then 'declined' when 'withdraw' then 'withdrawn' else 'expired' end,
  e.document_id,e.id,case when e.action='grant' then e.id end,case when e.action='grant' then e.agreed_at end,
  case when e.action='grant' then (e.agreed_at at time zone 'Asia/Seoul'+interval '2 years') at time zone 'Asia/Seoul' end,1
 from (select distinct on(profile_id) * from public.profile_consents where kind='marketing' order by profile_id,agreed_at desc,id desc) e
 where e.source='legacy'
 on conflict(profile_id,kind) do nothing;
 if public.get_consent_manifest()->>'bundle_version' is distinct from bundle_version then
  raise exception 'CONSENT_CONFIGURATION_UNAVAILABLE' using errcode='S1006';
 end if;
end;
$s1_activate$;
commit;
