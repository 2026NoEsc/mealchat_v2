# S5 Figma 음식 프로필 노드 명세

확인일: 2026-10-17. 원본: [MealChat Phone](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=478-9398), 파일 `euLZpuvJsmuOhVKwtDkdhJ`, 페이지 `Phone` (`478:9398`). Figma Plugin API의 읽기 조회와 화면 렌더를 근거로 작성했다. Figma 노드·변수·연결은 수정하지 않았다. 저장소에서는 이 파일만 생성했으며 커밋·원격 Supabase·`.env` 접근은 하지 않았다.

## 1. 확인 범위와 먼저 해결할 불일치

- 상세 화면 **9개**: 음식 프로필 5개 + 프로필 홈 1개 + 가입 캘린더 연동 1개 + 약관 동의 2개. 옆 주석 프레임 **9개**를 읽었다.
- 음식 섹션 `495:1025` “02 가입 · 음식 프로필”: Phone 기준 (4156,200), 2540×1627. 섹션 직속 자식 10개는 화면 5개와 주석 5개다. 프레임 목록 전체를 확인했다.
- **알레르기는 현재 Figma에서 복수 선택이다.** 화면 `495:1189`의 “여러 개 골라도 돼요”와 “알레르기 없음” 배타 규칙이 근거다. 요청/기존 S5 설계의 단일 선택과 충돌한다. 단일 선택으로 바꾸는 제품 결정을 이 문서에서 추정하지 않는다.
- “못 먹는 음식”의 현재 선택지는 **10개**다. 주석 `499:1283`의 “12개”는 현재 노드와 맞지 않는다.
- “음식 취향 매칭” `530:1438`은 완료 표시 상태이며 클릭 연결이 없다. 실제 편집 진입점은 `530:1483` “음식 취향 다시 고르기”다.
- 기존 사용자 전용 안내, “음식 취향 수정” 머리말/“저장” 버튼, STEP 2 재동의 시트, 기타 직접 입력의 입력창·키보드·검증 화면은 Phone에서 별도 화면 노드를 찾지 못했다. 주석의 의도와 존재하는 화면을 구분한다.
- 건강정보 미동의 화면 `590:2447`은 안내 문구와 달리 실제 건강 체크박스 `604:2850`이 **State=On**이다. 자식 Box의 주황 채움과 체크 벡터도 표시 상태다. 기본 스크린샷은 체크 해제로 보였으나 `contentsOnly=true`로 겹친 외부 콘텐츠를 제외한 렌더는 체크됨으로 확인됐다. “미동의 상태가 노드에도 구현됨”으로 판정할 수 없다.
- 기본 STEP 1의 화면 예시는 한식·일식이 함께 선택되어 있다. “상관없음” 화면의 한식을 누르면 이 기본 프레임으로 이동하므로, 주석의 “그 종류만 선택”과 달리 **한식·일식 두 개가 선택된 대표 상태**로 돌아간다.
- 현재 화면의 예시 선택은 사용자 최초 기본값이나 저장 규칙의 확정 근거가 아니다. 최대 선택 수, 필수 입력, 건너뛰기, 저장·통신 실패, 재동의 거절 후 동작은 이 화면들만으로 확정되지 않는다.

## 2. 좌표·스타일 읽는 법

단위는 Figma px. 화면 표의 “화면 xy”는 각 화면 왼쪽 위를 (0,0)으로 환산한 **스크롤 전 콘텐츠 좌표**다. “부모 xy”는 바로 위 부모에 대한 로컬 좌표다. 루트 행의 부모 xy는 섹션 기준 배치다. 화면 밖 y값도 원본 그대로 기재하여 스크롤 아래 콘텐츠를 포함했다. 텍스트는 별도 표에 원문을 모두 수록했다. `<br>`는 실제 줄바꿈이다.

구성 표는 **y→x 순서**이며 부모 ID로 계층을 연결한다. 겹치는 푸터와 스크롤 본문은 같은 y대에 공존한다. 텍스트가 아닌 FRAME/INSTANCE/RECTANGLE/ELLIPSE 등의 구성 요소를 수록했고, 아이콘의 벡터 path 데이터는 문서 목적상 제외했다. 아이콘 프레임의 크기·위치는 포함한다. 이미지 내부의 글자는 TEXT 노드가 아니므로 원본 글꼴·크기·문자열은 확정하지 않는다(가입 캘린더 예시 이미지 등).

레이아웃 표기: H=가로, V=세로, gap=주축 간격, cross=줄/교차축 간격, pad=위/오른쪽/아래/왼쪽. 반경/테두리 두께는 확인된 음식 화면 컨테이너에 기재한다. 테두리 inset 때문에 설정 pad16이 실제 자식 xy17 또는17.5로 나타날 수 있다.

### 2.1 색 변수

| 변수 이름 | ID | 값 (mode 493:0) |
|---|---|---|
| color/bg | `VariableID:493:1026` | `#f8f6f2` |
| color/surface | `VariableID:493:1027` | `#ffffff` |
| color/border | `VariableID:493:1028` | `#e8e3dc` |
| color/primary | `VariableID:493:1029` | `#ff9900` |
| color/on-primary | `VariableID:493:1030` | `#1c1a17` |
| color/ink | `VariableID:493:1031` | `#1c1a17` |
| color/sub | `VariableID:493:1032` | `#6b665f` |
| color/selected-bg | `VariableID:493:1033` | `#fff3e0` |
| color/selected-text | `VariableID:493:1034` | `#8a4b00` |
| color/safe-bg | `VariableID:493:1035` | `#e8f5ec` |
| color/safe-text | `VariableID:493:1036` | `#1e6b34` |
| color/muted-bg | `VariableID:493:1037` | `#f1eee9` |

### 2.2 텍스트 스타일

각 화면의 텍스트 표에서 아래 T 코드를 참조한다. 굵기는 숫자 fontWeight를 사용하며 원본 폰트 style도 보존했다. 실제 모든 TEXT 노드는 단일 스타일 run이었다.

| 스타일 | 글꼴 / style | 크기 | 굵기 | 글자색 / 변수 | 행간 |
|---|---|---|---|---|---|
| T01 | 42dot Sans / Bold | 13 | 700 | #8a4b00 (color/selected-text) | 145 PERCENT |
| T02 | 42dot Sans / Bold | 22 | 700 | #1c1a17 (color/ink) | 145 PERCENT |
| T03 | 42dot Sans / Regular | 14 | 400 | #6b665f (color/sub) | 145 PERCENT |
| T04 | 42dot Sans / Bold | 16 | 700 | #1c1a17 (color/ink) | 145 PERCENT |
| T05 | 42dot Sans / Regular | 13 | 400 | #6b665f (color/sub) | 145 PERCENT |
| T06 | 42dot Sans / Bold | 14 | 700 | #8a4b00 (color/selected-text) | 140 PERCENT |
| T07 | 42dot Sans / Regular | 14 | 400 | #1c1a17 (color/ink) | 140 PERCENT |
| T08 | 42dot Sans / Medium | 13 | 500 | #6b665f (color/sub) | 145 PERCENT |
| T09 | 42dot Sans / Bold | 16 | 700 | #1c1a17 (color/on-primary) | 140 PERCENT |
| T10 | 42dot Sans / Regular | 13 | 400 | #8a4b00 (color/selected-text) | 145 PERCENT |
| T11 | 42dot Sans / Bold | 20 | 700 | #1c1a17 (color/ink) | 145 PERCENT |
| T12 | 42dot Sans / Bold | 14 | 700 | #1c1a17 (color/ink) | 145 PERCENT |
| T13 | 42dot Sans / Medium | 14 | 500 | #1c1a17 (color/ink) | 145 PERCENT |
| T14 | 42dot Sans / Bold | 14 | 700 | #8a4b00 (color/selected-text) | 145 PERCENT |
| T15 | 42dot Sans / Regular | 15 | 400 | #6b665f (color/sub) | 145 PERCENT |
| T16 | 42dot Sans / Bold | 13 | 700 | #1e6b34 (color/safe-text) | 145 PERCENT |
| T17 | 42dot Sans / Medium | 15 | 500 | #1c1a17 (color/ink) | 145 PERCENT |
| T18 | 42dot Sans / Medium | 14 | 500 | #6b665f (color/sub) | 145 PERCENT |
| T19 | 42dot Sans / Medium | 14 | 500 | #8c867e (직접값) | 145 PERCENT |
| T20 | 42dot Sans / Regular | 12 | 400 | #8c867e (직접값) | 145 PERCENT |
| T21 | 42dot Sans / Medium | 12 | 500 | #6b665f (color/sub) | 145 PERCENT |
| T22 | 42dot Sans / Bold | 12 | 700 | #8a4b00 (color/selected-text) | 145 PERCENT |
| T23 | 42dot Sans / Bold | 15 | 700 | #1c1a17 (color/ink) | 145 PERCENT |
| T24 | 42dot Sans / Bold | 16 | 700 | #6b665f (color/sub) | 140 PERCENT |
| T25 | 42dot Sans / Medium | 14 | 500 | #8a4b00 (color/selected-text) | 145 PERCENT |
| T26 | 42dot Sans / Regular | 15 | 400 | #1c1a17 (color/ink) | 145 PERCENT |

### 2.3 실제 사용 컴포넌트와 상태

| 컴포넌트 | 마스터 노드 | 상태·표현 |
|---|---|---|
| Chip | Default `493:1039`, Selected `493:1041` (set `493:1045`) | 높이44, 반경22. Default: surface/border, 1px stroke, ink 14/400. Selected: selected-bg/primary, 1.5px stroke, 체크 + selected-text 14/700. 가로 pad16, 체크14, 체크-라벨 gap4 |
| Radio | Off `493:1053`, On `493:1056` (set `493:1059`) | 338×44, 아이콘과 텍스트 gap12. Off ink 14/400, On selected-text 14/700. 단일 선택은 화면 문구의 규칙이며 모든 라디오가 그룹 단위로 해제되는지는 프로토타입에서 증명되지 않음 |
| Button | Primary `493:1046`, Text `493:1050` (set `493:1052`) | 음식 CTA 372×52, Primary 배경 primary, 글자 on-primary 16/700, 반경14. 캘린더의 나중에 버튼은 Kind=Text |
| ListRow | `518:1280` | 프로필 메뉴. 제목·값·Show Value 속성. 편집 진입 행은 Show Value=false |
| AppHeader | `518:1286` | 프로필 상단, Unread=true |
| BottomNav | 프로필 탭 variant `518:1247` (set `518:1263`) | Tab=프로필 |
| Checkbox | On `597:2227`, Off `597:2231` (set `597:2233`) | 44×44 터치 영역 안 Box22×22. On primary+체크, Off surface+직접값 테두리 `#8c867e` |

음식 화면에는 Disabled variant나 비활성 CTA가 없다. 선택/비선택은 Chip 및 Radio 상태로 확인했다. 프로필의 “계정 삭제 · 준비 중”은 음식 프로필의 비활성 상태가 아니다.

### 2.4 공통 음식 화면 구조

5개 모두 412×892. Header (0,0,412,219), Body (0,219,412,673), absolute Footer (0,804,412,88)이다. Body가 Footer 뒤까지 이어지므로 y804 이후는 스크롤로 확인한다. Header pad=16/20/20/20, gap12. Top Bar (20,16,372,44), Back44×44. Progress (20,72,372,4): 88.5 폭 4개, gap6, 3개 primary + 마지막 border. Title (20,88,372,111), 내부 위 여백8, gap6. Body 좌우20, 카드 간12, 아래 pad8. CTA (20,817,372,52)는 Footer 내부 (20,13)이다. 원본 Footer paddingTop은12이지만 실제 CTA y는13으로 기록되어 있어 실측을 보존했다.

STEP 1 일반 상태의 Card01은238 높이이고 “상관없음” 상태는186 높이다. 선택으로 칩 폭/줄바꿈이 달라져 이후 카드가52 위로 이동한다. Chip 행 간격8, 44 높이이므로 다음 행 y차52다. Radio 행은44 높이, 행 사이 gap0이다. STEP 2의 펼친 아코디언은 primary 1.5px 테두리, 접힌 것은 border 1px, 반경16이다.

## 3. 화면별 노드 명세

### 3.1 가입/음식 프로필 STEP 1

노드 [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026), 크기 412×892, 섹션 내 배치 (0,120). 비벡터 하위 노드 및 루트 133개를 추출했다.

음식 종류는 한식·일식, 주재료는 돼지고기·닭고기, 형태는 면·국물·탕·구이, 매운맛은 보통이 선택된 예시다. 음식 종류·주재료·형태는 복수, 매운맛은 단일이다. ‘상관없음’은 음식 종류 그룹에만 있고 주재료·형태·매운맛 그룹에는 같은 sentinel 선택지가 없다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `495:1026` 가입/음식 프로필 STEP 1 (FRAME) | 섹션 | 0,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `495:1027` Header (FRAME) | 495:1026 | 0,0 | 0,0 | 412×219 | V gap12 cross0 pad16/20/20/20; clip |
| `495:1028` Top Bar (FRAME) | 495:1027 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1029` Back (FRAME) | 495:1028 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1030` Frame (FRAME) | 495:1029 | 0,10 | 20,26 | 24×24 | fill #ffffff (직접값); clip |
| `495:1033` Progress (FRAME) | 495:1027 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0; clip |
| `495:1034` Rectangle (RECTANGLE) | 495:1033 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `495:1035` Rectangle (RECTANGLE) | 495:1033 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1523` Rectangle (RECTANGLE) | 495:1033 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1524` Rectangle (RECTANGLE) | 495:1033 | 283.5,0 | 303.5,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `495:1036` Title (FRAME) | 495:1027 | 20,88 | 20,88 | 372×111 | V gap6 cross0 pad8/0/0/0; clip |
| `495:1039` Body (FRAME) | 495:1026 | 0,219 | 0,219 | 412×673 | V gap12 cross0 pad0/20/8/20; scroll VERTICAL; clip |
| `495:1043` Card 01 (FRAME) | 495:1039 | 20,0 | 20,219 | 372×238 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1044` Card Header (FRAME) | 495:1043 | 17,17 | 37,236 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1045` Frame (FRAME) | 495:1044 | 0,0 | 37,236 | 114×23 | H gap8 cross0 pad0/0/0/0; clip |
| `495:1049` Chips (FRAME) | 495:1043 | 17,73 | 37,292 | 338×148 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1050` Chip (INSTANCE) | 495:1049 | 0,0 | 37,292 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=한식; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1054` Chip (INSTANCE) | 495:1049 | 85,0 | 122,292 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=일식; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1058` Chip (INSTANCE) | 495:1049 | 170,0 | 207,292 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=중식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1060` Chip (INSTANCE) | 495:1049 | 236,0 | 273,292 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=양식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I495:1050;493:1042` icon/check (FRAME) | 495:1050 | 17.5,15 | 54.5,307 | 14×14 | fill #ffffff (직접값); clip |
| `I495:1054;493:1042` icon/check (FRAME) | 495:1054 | 17.5,15 | 139.5,307 | 14×14 | fill #ffffff (직접값); clip |
| `495:1062` Chip (INSTANCE) | 495:1049 | 0,52 | 37,344 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=동남아; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1064` Chip (INSTANCE) | 495:1049 | 78,52 | 115,344 | 110×44 | H gap4 cross0 pad0/16/0/16; Label=기타 세계음식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1066` Chip (INSTANCE) | 495:1049 | 196,52 | 233,344 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=분식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1068` Chip (INSTANCE) | 495:1049 | 0,104 | 37,396 | 82×44 | H gap4 cross0 pad0/16/0/16; Label=상관없음; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1070` Card 02 (FRAME) | 495:1039 | 20,250 | 20,469 | 372×443 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1071` Card Header (FRAME) | 495:1070 | 17,17 | 37,486 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1072` Frame (FRAME) | 495:1071 | 0,0 | 37,486 | 97×23 | H gap8 cross0 pad0/0/0/0; clip |
| `495:1077` Chips (FRAME) | 495:1070 | 17,104 | 37,573 | 338×96 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1078` Chip (INSTANCE) | 495:1077 | 0,0 | 37,573 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=소고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1080` Chip (INSTANCE) | 495:1077 | 78,0 | 115,573 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=돼지고기; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1084` Chip (INSTANCE) | 495:1077 | 187,0 | 224,573 | 89×44 | H gap4 cross0 pad0/16/0/16; Label=닭고기; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `I495:1080;493:1042` icon/check (FRAME) | 495:1080 | 17.5,15 | 132.5,588 | 14×14 | fill #ffffff (직접값); clip |
| `I495:1084;493:1042` icon/check (FRAME) | 495:1084 | 17.5,15 | 241.5,588 | 14×14 | fill #ffffff (직접값); clip |
| `495:1088` Chip (INSTANCE) | 495:1077 | 0,52 | 37,625 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=양고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1091` Chips (FRAME) | 495:1070 | 17,243 | 37,712 | 338×96 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1092` Chip (INSTANCE) | 495:1091 | 0,0 | 37,712 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=생선; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1094` Chip (INSTANCE) | 495:1091 | 66,0 | 103,712 | 132×44 | H gap4 cross0 pad0/16/0/16; Label=새우·게 등 갑각류; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1096` Chip (INSTANCE) | 495:1091 | 206,0 | 243,712 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=조개류; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1098` Chip (INSTANCE) | 495:1091 | 0,52 | 37,764 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=오징어·문어; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1040` Footer (FRAME) | 495:1026 | 0,804 | 0,804 | 412×88 | V gap0 cross0 pad12/20/0/20; fill #f8f6f2 (color/bg); stroke #e8e3dc (color/border); clip; strokeWidthnull; ABSOLUTE |
| `495:1041` CTA (INSTANCE) | 495:1040 | 20,13 | 20,817 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=다음; Kind=Primary; fill #ff9900 (color/primary); radius14 |
| `495:1101` Chips (FRAME) | 495:1070 | 17,382 | 37,851 | 338×44 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1102` Chip (INSTANCE) | 495:1101 | 0,0 | 37,851 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=계란; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1104` Chip (INSTANCE) | 495:1101 | 66,0 | 103,851 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=두부·콩; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1106` Chip (INSTANCE) | 495:1101 | 151,0 | 188,851 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=채소; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1108` Chip (INSTANCE) | 495:1101 | 217,0 | 254,851 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=치즈·유제품; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1110` Card 03 (FRAME) | 495:1039 | 20,705 | 20,924 | 372×238 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1111` Card Header (FRAME) | 495:1110 | 17,17 | 37,941 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1112` Frame (FRAME) | 495:1111 | 0,0 | 37,941 | 115×23 | H gap8 cross0 pad0/0/0/0; clip |
| `495:1116` Chips (FRAME) | 495:1110 | 17,73 | 37,997 | 338×148 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1117` Chip (INSTANCE) | 495:1116 | 0,0 | 37,997 | 46×44 | H gap4 cross0 pad0/16/0/16; Label=밥; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1119` Chip (INSTANCE) | 495:1116 | 54,0 | 91,997 | 65×44 | H gap4 cross0 pad0/16/0/16; Label=면; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1123` Chip (INSTANCE) | 495:1116 | 127,0 | 164,997 | 96×44 | H gap4 cross0 pad0/16/0/16; Label=국물·탕; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1127` Chip (INSTANCE) | 495:1116 | 231,0 | 268,997 | 89×44 | H gap4 cross0 pad0/16/0/16; Label=찌개·전골; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I495:1119;493:1042` icon/check (FRAME) | 495:1119 | 17.5,15 | 108.5,1012 | 14×14 | fill #ffffff (직접값); clip |
| `I495:1123;493:1042` icon/check (FRAME) | 495:1123 | 17.5,15 | 181.5,1012 | 14×14 | fill #ffffff (직접값); clip |
| `495:1129` Chip (INSTANCE) | 495:1116 | 0,52 | 37,1049 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=구이; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1133` Chip (INSTANCE) | 495:1116 | 85,52 | 122,1049 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=튀김; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1135` Chip (INSTANCE) | 495:1116 | 151,52 | 188,1049 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=볶음; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1137` Chip (INSTANCE) | 495:1116 | 217,52 | 254,1049 | 46×44 | H gap4 cross0 pad0/16/0/16; Label=찜; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I495:1129;493:1042` icon/check (FRAME) | 495:1129 | 17.5,15 | 54.5,1064 | 14×14 | fill #ffffff (직접값); clip |
| `495:1139` Chip (INSTANCE) | 495:1116 | 0,104 | 37,1101 | 141×44 | H gap4 cross0 pad0/16/0/16; Label=샐러드·가벼운 식사; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1141` Card 04 (FRAME) | 495:1039 | 20,955 | 20,1174 | 372×310 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1142` Card Header (FRAME) | 495:1141 | 17,17 | 37,1191 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1143` Frame (FRAME) | 495:1142 | 0,0 | 37,1191 | 112×23 | H gap8 cross0 pad0/0/0/0; clip |
| `495:1147` Radios (FRAME) | 495:1141 | 17,73 | 37,1247 | 338×220 | V gap0 cross0 pad0/0/0/0; clip |
| `495:1148` Radio (INSTANCE) | 495:1147 | 0,0 | 37,1247 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=전혀 못 먹음; State=Off |
| `I495:1148;493:1054` dot (ELLIPSE) | 495:1148 | 0,12 | 37,1259 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `495:1151` Radio (INSTANCE) | 495:1147 | 0,44 | 37,1291 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=조금 매운 정도; State=Off |
| `I495:1151;493:1054` dot (ELLIPSE) | 495:1151 | 0,12 | 37,1303 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `495:1154` Radio (INSTANCE) | 495:1147 | 0,88 | 37,1335 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=보통; State=On |
| `I495:1154;493:1057` dot (ELLIPSE) | 495:1154 | 0,12 | 37,1347 | 20×20 | fill #ffffff (color/surface); stroke #ff9900 (color/primary) |
| `495:1157` Radio (INSTANCE) | 495:1147 | 0,132 | 37,1379 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=매운 음식 좋아함; State=Off |
| `I495:1157;493:1054` dot (ELLIPSE) | 495:1157 | 0,12 | 37,1391 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `495:1160` Radio (INSTANCE) | 495:1147 | 0,176 | 37,1423 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=아주 매운 음식도 좋아함; State=Off |
| `I495:1160;493:1054` dot (ELLIPSE) | 495:1160 | 0,12 | 37,1435 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `667:12744` Bottom Spacer (FRAME) | 495:1039 | 20,1277 | 20,1496 | 372×92 | clip |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `495:1032` | STEP 3 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `539:1525` | 음식 프로필 1 / 2 · 좋아하는 음식 | 0,8 | 20,96 | 171×19 | T01 | 표시 (부모 clip 적용) |
| `495:1037` | 어떤 음식을 좋아하세요? | 0,33 | 20,121 | 211×32 | T02 | 표시 (부모 clip 적용) |
| `495:1038` | 밥약 메뉴를 추천할 때 기본으로 써요. 나중에 프로필에서 바꿀 수 있어요. | 0,71 | 20,159 | 372×40 | T03 | 표시 (부모 clip 적용) |
| `495:1047` | 선호 음식 종류 | 23,0 | 60,236 | 91×23 | T04 | 표시 (부모 clip 적용) |
| `495:1046` | 01 | 0,2 | 37,238 | 15×19 | T01 | 표시 (부모 clip 적용) |
| `495:1048` | 여러 개 골라도 돼요 · ‘상관없음’을 고르면 나머지는 해제돼요 | 0,25 | 37,261 | 306×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1050;493:1044` | 한식 | 35.5,12 | 72.5,304 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1054;493:1044` | 일식 | 35.5,12 | 157.5,304 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1058;493:1040` | 중식 | 17,12 | 224,304 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1060;493:1040` | 양식 | 17,12 | 290,304 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1062;493:1040` | 동남아 | 17,12 | 54,356 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1064;493:1040` | 기타 세계음식 | 17,12 | 132,356 | 76×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1066;493:1040` | 분식 | 17,12 | 250,356 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1068;493:1040` | 상관없음 | 17,12 | 54,408 | 48×20 | T07 | 표시 (부모 clip 적용) |
| `495:1074` | 선호 주재료 | 24,0 | 61,486 | 73×23 | T04 | 표시 (부모 clip 적용) |
| `495:1073` | 02 | 0,2 | 37,488 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1075` | 여러 개 골라도 돼요 | 0,25 | 37,511 | 99×19 | T05 | 표시 (부모 clip 적용) |
| `495:1076` | 육류 | 17,73 | 37,542 | 23×19 | T08 | 표시 (부모 clip 적용) |
| `I495:1078;493:1040` | 소고기 | 17,12 | 54,585 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1080;493:1044` | 돼지고기 | 35.5,12 | 150.5,585 | 48×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1084;493:1044` | 닭고기 | 35.5,12 | 259.5,585 | 36×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1088;493:1040` | 양고기 | 17,12 | 54,637 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `495:1090` | 해산물 | 17,212 | 37,681 | 34×19 | T08 | 표시 (부모 clip 적용) |
| `I495:1092;493:1040` | 생선 | 17,12 | 54,724 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1094;493:1040` | 새우·게 등 갑각류 | 17,12 | 120,724 | 98×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1096;493:1040` | 조개류 | 17,12 | 260,724 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1098;493:1040` | 오징어·문어 | 17,12 | 54,776 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `495:1100` | 기타 | 17,351 | 37,820 | 23×19 | T08 | 표시 (부모 clip 적용) |
| `I495:1041;493:1047` | 다음 | 172,15 | 192,832 | 28×22 | T09 | 표시 (부모 clip 적용) |
| `I495:1102;493:1040` | 계란 | 17,12 | 54,863 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1104;493:1040` | 두부·콩 | 17,12 | 120,863 | 43×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1106;493:1040` | 채소 | 17,12 | 205,863 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1108;493:1040` | 치즈·유제품 | 17,12 | 271,863 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `495:1114` | 선호 음식 형태 | 24,0 | 61,941 | 91×23 | T04 | 표시 (부모 clip 적용) |
| `495:1113` | 03 | 0,2 | 37,943 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1115` | 여러 개 골라도 돼요 | 0,25 | 37,966 | 99×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1117;493:1040` | 밥 | 17,12 | 54,1009 | 12×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1119;493:1044` | 면 | 35.5,12 | 126.5,1009 | 12×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1123;493:1044` | 국물·탕 | 35.5,12 | 199.5,1009 | 43×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1127;493:1040` | 찌개·전골 | 17,12 | 285,1009 | 55×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1129;493:1044` | 구이 | 35.5,12 | 72.5,1061 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1133;493:1040` | 튀김 | 17,12 | 139,1061 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1135;493:1040` | 볶음 | 17,12 | 205,1061 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1137;493:1040` | 찜 | 17,12 | 271,1061 | 12×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1139;493:1040` | 샐러드·가벼운 식사 | 17,12 | 54,1113 | 107×20 | T07 | 표시 (부모 clip 적용) |
| `495:1145` | 매운맛 선호도 | 25,0 | 62,1191 | 87×23 | T04 | 표시 (부모 clip 적용) |
| `495:1144` | 04 | 0,2 | 37,1193 | 17×19 | T01 | 표시 (부모 clip 적용) |
| `495:1146` | 하나만 골라 주세요 | 0,25 | 37,1216 | 96×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1148;493:1055` | 전혀 못 먹음 | 32,12 | 69,1259 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1151;493:1055` | 조금 매운 정도 | 32,12 | 69,1303 | 79×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1154;493:1058` | 보통 | 32,12 | 69,1347 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1157;493:1055` | 매운 음식 좋아함 | 32,12 | 69,1391 | 91×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1160;493:1055` | 아주 매운 음식도 좋아함 | 32,12 | 69,1435 | 131×20 | T07 | 표시 (부모 clip 적용) |

#### 선택지 전체와 현재 상태

| 범주 | 라벨 원문 | 노드 | 방식·배타 규칙 | 현재 variant |
|---|---|---|---|---|
| 음식 종류 | 한식 | `495:1050` | 복수 / 상관없음 배타 | Selected |
| 음식 종류 | 일식 | `495:1054` | 복수 / 상관없음 배타 | Selected |
| 음식 종류 | 중식 | `495:1058` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 양식 | `495:1060` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 동남아 | `495:1062` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 기타 세계음식 | `495:1064` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 분식 | `495:1066` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 상관없음 | `495:1068` | 복수 / 상관없음 배타 | Default |
| 주재료 | 소고기 | `495:1078` | 복수 | Default |
| 주재료 | 돼지고기 | `495:1080` | 복수 | Selected |
| 주재료 | 닭고기 | `495:1084` | 복수 | Selected |
| 주재료 | 양고기 | `495:1088` | 복수 | Default |
| 주재료 | 생선 | `495:1092` | 복수 | Default |
| 주재료 | 새우·게 등 갑각류 | `495:1094` | 복수 | Default |
| 주재료 | 조개류 | `495:1096` | 복수 | Default |
| 주재료 | 오징어·문어 | `495:1098` | 복수 | Default |
| 주재료 | 계란 | `495:1102` | 복수 | Default |
| 주재료 | 두부·콩 | `495:1104` | 복수 | Default |
| 주재료 | 채소 | `495:1106` | 복수 | Default |
| 주재료 | 치즈·유제품 | `495:1108` | 복수 | Default |
| 음식 형태 | 밥 | `495:1117` | 복수 | Default |
| 음식 형태 | 면 | `495:1119` | 복수 | Selected |
| 음식 형태 | 국물·탕 | `495:1123` | 복수 | Selected |
| 음식 형태 | 찌개·전골 | `495:1127` | 복수 | Default |
| 음식 형태 | 구이 | `495:1129` | 복수 | Selected |
| 음식 형태 | 튀김 | `495:1133` | 복수 | Default |
| 음식 형태 | 볶음 | `495:1135` | 복수 | Default |
| 음식 형태 | 찜 | `495:1137` | 복수 | Default |
| 음식 형태 | 샐러드·가벼운 식사 | `495:1139` | 복수 | Default |
| 매운맛 | 전혀 못 먹음 | `495:1148` | 단일 | Off |
| 매운맛 | 조금 매운 정도 | `495:1151` | 단일 | Off |
| 매운맛 | 보통 | `495:1154` | 단일 | On |
| 매운맛 | 매운 음식 좋아함 | `495:1157` | 단일 | Off |
| 매운맛 | 아주 매운 음식도 좋아함 | `495:1160` | 단일 | Off |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `495:1029` Back | NAVIGATE | [520:1244](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1244) 회원가입/구글 캘린더 연동 |
| `495:1050` 한식 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1054` 일식 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1058` 중식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1060` 양식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1062` 동남아 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1064` 기타 세계음식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1066` 분식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1068` 상관없음 | NAVIGATE | [590:2282](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=590-2282) 가입/음식 프로필 STEP 1 · 상관없음 선택 |
| `495:1078` 소고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1080` 돼지고기 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1084` 닭고기 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1088` 양고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1092` 생선 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1094` 새우·게 등 갑각류 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1096` 조개류 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1098` 오징어·문어 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1102` 계란 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1104` 두부·콩 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1106` 채소 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1108` 치즈·유제품 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1117` 밥 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1119` 면 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1123` 국물·탕 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1127` 찌개·전골 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1129` 구이 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1133` 튀김 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1135` 볶음 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1137` 찜 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1139` 샐러드·가벼운 식사 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1148` 전혀 못 먹음 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `495:1151` 조금 매운 정도 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `495:1157` 매운 음식 좋아함 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `495:1160` 아주 매운 음식도 좋아함 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `495:1041` 다음 | NAVIGATE | [495:1163](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1163) 가입/음식 프로필 STEP 2 · 알레르기 |

### 3.2 가입/음식 프로필 STEP 1 · 상관없음 선택

노드 [590:2282](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=590-2282), 크기 412×892, 섹션 내 배치 (532,120). 비벡터 하위 노드 및 루트 132개를 추출했다.

음식 종류는 ‘상관없음’만 Selected, 다른 7개 종류는 Default다. 주재료·형태·매운맛은 일반 STEP 1의 예시 선택을 유지한다. 다른 종류 선택 시 상관없음을 해제한다는 주석 규칙을 적용하되 프로토타입은 대표 상태 전환만 구현한다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `590:2282` 가입/음식 프로필 STEP 1 · 상관없음 선택 (FRAME) | 섹션 | 532,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `590:2283` Header (FRAME) | 590:2282 | 0,0 | 0,0 | 412×219 | V gap12 cross0 pad16/20/20/20; clip |
| `590:2284` Top Bar (FRAME) | 590:2283 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0; clip |
| `590:2285` Back (FRAME) | 590:2284 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0; clip |
| `590:2286` Frame (FRAME) | 590:2285 | 0,10 | 20,26 | 24×24 | fill #ffffff (직접값); clip |
| `590:2289` Progress (FRAME) | 590:2283 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0; clip |
| `590:2290` Rectangle (RECTANGLE) | 590:2289 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2291` Rectangle (RECTANGLE) | 590:2289 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2292` Rectangle (RECTANGLE) | 590:2289 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2293` Rectangle (RECTANGLE) | 590:2289 | 283.5,0 | 303.5,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `590:2294` Title (FRAME) | 590:2283 | 20,88 | 20,88 | 372×111 | V gap6 cross0 pad8/0/0/0; clip |
| `590:2298` Body (FRAME) | 590:2282 | 0,219 | 0,219 | 412×673 | V gap12 cross0 pad0/20/8/20; scroll VERTICAL; clip |
| `590:2299` Card 01 (FRAME) | 590:2298 | 20,0 | 20,219 | 372×186 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `590:2300` Card Header (FRAME) | 590:2299 | 17,17 | 37,236 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `590:2301` Frame (FRAME) | 590:2300 | 0,0 | 37,236 | 114×23 | H gap8 cross0 pad0/0/0/0; clip |
| `590:2305` Chips (FRAME) | 590:2299 | 17,73 | 37,292 | 338×96 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `590:2306` Chip (INSTANCE) | 590:2305 | 0,0 | 37,292 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=한식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2307` Chip (INSTANCE) | 590:2305 | 66,0 | 103,292 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=일식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2308` Chip (INSTANCE) | 590:2305 | 132,0 | 169,292 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=중식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2309` Chip (INSTANCE) | 590:2305 | 198,0 | 235,292 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=양식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2310` Chip (INSTANCE) | 590:2305 | 264,0 | 301,292 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=동남아; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2311` Chip (INSTANCE) | 590:2305 | 0,52 | 37,344 | 110×44 | H gap4 cross0 pad0/16/0/16; Label=기타 세계음식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2312` Chip (INSTANCE) | 590:2305 | 118,52 | 155,344 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=분식; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2313` Chip (INSTANCE) | 590:2305 | 184,52 | 221,344 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=상관없음; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `I590:2313;493:1042` icon/check (FRAME) | 590:2313 | 17.5,15 | 238.5,359 | 14×14 | fill #ffffff (직접값); clip |
| `590:2314` Card 02 (FRAME) | 590:2298 | 20,198 | 20,417 | 372×443 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `590:2315` Card Header (FRAME) | 590:2314 | 17,17 | 37,434 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `590:2316` Frame (FRAME) | 590:2315 | 0,0 | 37,434 | 97×23 | H gap8 cross0 pad0/0/0/0; clip |
| `590:2321` Chips (FRAME) | 590:2314 | 17,104 | 37,521 | 338×96 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `590:2322` Chip (INSTANCE) | 590:2321 | 0,0 | 37,521 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=소고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2323` Chip (INSTANCE) | 590:2321 | 78,0 | 115,521 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=돼지고기; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `590:2324` Chip (INSTANCE) | 590:2321 | 187,0 | 224,521 | 89×44 | H gap4 cross0 pad0/16/0/16; Label=닭고기; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `I590:2323;493:1042` icon/check (FRAME) | 590:2323 | 17.5,15 | 132.5,536 | 14×14 | fill #ffffff (직접값); clip |
| `I590:2324;493:1042` icon/check (FRAME) | 590:2324 | 17.5,15 | 241.5,536 | 14×14 | fill #ffffff (직접값); clip |
| `590:2325` Chip (INSTANCE) | 590:2321 | 0,52 | 37,573 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=양고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2327` Chips (FRAME) | 590:2314 | 17,243 | 37,660 | 338×96 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `590:2328` Chip (INSTANCE) | 590:2327 | 0,0 | 37,660 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=생선; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2329` Chip (INSTANCE) | 590:2327 | 66,0 | 103,660 | 132×44 | H gap4 cross0 pad0/16/0/16; Label=새우·게 등 갑각류; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2330` Chip (INSTANCE) | 590:2327 | 206,0 | 243,660 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=조개류; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2331` Chip (INSTANCE) | 590:2327 | 0,52 | 37,712 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=오징어·문어; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2333` Chips (FRAME) | 590:2314 | 17,382 | 37,799 | 338×44 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `590:2334` Chip (INSTANCE) | 590:2333 | 0,0 | 37,799 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=계란; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2335` Chip (INSTANCE) | 590:2333 | 66,0 | 103,799 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=두부·콩; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2336` Chip (INSTANCE) | 590:2333 | 151,0 | 188,799 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=채소; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2337` Chip (INSTANCE) | 590:2333 | 217,0 | 254,799 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=치즈·유제품; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2366` Footer (FRAME) | 590:2282 | 0,804 | 0,804 | 412×88 | V gap0 cross0 pad12/20/0/20; fill #f8f6f2 (color/bg); stroke #e8e3dc (color/border); clip; strokeWidthnull; ABSOLUTE |
| `590:2367` CTA (INSTANCE) | 590:2366 | 20,13 | 20,817 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=다음; Kind=Primary; fill #ff9900 (color/primary); radius14 |
| `590:2338` Card 03 (FRAME) | 590:2298 | 20,653 | 20,872 | 372×238 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `590:2339` Card Header (FRAME) | 590:2338 | 17,17 | 37,889 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `590:2340` Frame (FRAME) | 590:2339 | 0,0 | 37,889 | 115×23 | H gap8 cross0 pad0/0/0/0; clip |
| `590:2344` Chips (FRAME) | 590:2338 | 17,73 | 37,945 | 338×148 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `590:2345` Chip (INSTANCE) | 590:2344 | 0,0 | 37,945 | 46×44 | H gap4 cross0 pad0/16/0/16; Label=밥; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2346` Chip (INSTANCE) | 590:2344 | 54,0 | 91,945 | 65×44 | H gap4 cross0 pad0/16/0/16; Label=면; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `590:2347` Chip (INSTANCE) | 590:2344 | 127,0 | 164,945 | 96×44 | H gap4 cross0 pad0/16/0/16; Label=국물·탕; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `590:2348` Chip (INSTANCE) | 590:2344 | 231,0 | 268,945 | 89×44 | H gap4 cross0 pad0/16/0/16; Label=찌개·전골; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I590:2346;493:1042` icon/check (FRAME) | 590:2346 | 17.5,15 | 108.5,960 | 14×14 | fill #ffffff (직접값); clip |
| `I590:2347;493:1042` icon/check (FRAME) | 590:2347 | 17.5,15 | 181.5,960 | 14×14 | fill #ffffff (직접값); clip |
| `590:2349` Chip (INSTANCE) | 590:2344 | 0,52 | 37,997 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=구이; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `590:2350` Chip (INSTANCE) | 590:2344 | 85,52 | 122,997 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=튀김; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2351` Chip (INSTANCE) | 590:2344 | 151,52 | 188,997 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=볶음; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2352` Chip (INSTANCE) | 590:2344 | 217,52 | 254,997 | 46×44 | H gap4 cross0 pad0/16/0/16; Label=찜; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I590:2349;493:1042` icon/check (FRAME) | 590:2349 | 17.5,15 | 54.5,1012 | 14×14 | fill #ffffff (직접값); clip |
| `590:2353` Chip (INSTANCE) | 590:2344 | 0,104 | 37,1049 | 141×44 | H gap4 cross0 pad0/16/0/16; Label=샐러드·가벼운 식사; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `590:2354` Card 04 (FRAME) | 590:2298 | 20,903 | 20,1122 | 372×310 | V gap12 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `590:2355` Card Header (FRAME) | 590:2354 | 17,17 | 37,1139 | 338×44 | V gap2 cross0 pad0/0/0/0; clip |
| `590:2356` Frame (FRAME) | 590:2355 | 0,0 | 37,1139 | 112×23 | H gap8 cross0 pad0/0/0/0; clip |
| `590:2360` Radios (FRAME) | 590:2354 | 17,73 | 37,1195 | 338×220 | V gap0 cross0 pad0/0/0/0; clip |
| `590:2361` Radio (INSTANCE) | 590:2360 | 0,0 | 37,1195 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=전혀 못 먹음; State=Off |
| `I590:2361;493:1054` dot (ELLIPSE) | 590:2361 | 0,12 | 37,1207 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `590:2362` Radio (INSTANCE) | 590:2360 | 0,44 | 37,1239 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=조금 매운 정도; State=Off |
| `I590:2362;493:1054` dot (ELLIPSE) | 590:2362 | 0,12 | 37,1251 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `590:2363` Radio (INSTANCE) | 590:2360 | 0,88 | 37,1283 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=보통; State=On |
| `I590:2363;493:1057` dot (ELLIPSE) | 590:2363 | 0,12 | 37,1295 | 20×20 | fill #ffffff (color/surface); stroke #ff9900 (color/primary) |
| `590:2364` Radio (INSTANCE) | 590:2360 | 0,132 | 37,1327 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=매운 음식 좋아함; State=Off |
| `I590:2364;493:1054` dot (ELLIPSE) | 590:2364 | 0,12 | 37,1339 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `590:2365` Radio (INSTANCE) | 590:2360 | 0,176 | 37,1371 | 338×44 | H gap12 cross0 pad0/0/0/0; Label=아주 매운 음식도 좋아함; State=Off |
| `I590:2365;493:1054` dot (ELLIPSE) | 590:2365 | 0,12 | 37,1383 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `667:12748` Bottom Spacer (FRAME) | 590:2298 | 20,1225 | 20,1444 | 372×92 | clip |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `590:2288` | STEP 3 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `590:2295` | 음식 프로필 1 / 2 · 좋아하는 음식 | 0,8 | 20,96 | 171×19 | T01 | 표시 (부모 clip 적용) |
| `590:2296` | 어떤 음식을 좋아하세요? | 0,33 | 20,121 | 211×32 | T02 | 표시 (부모 clip 적용) |
| `590:2297` | 밥약 메뉴를 추천할 때 기본으로 써요. 나중에 프로필에서 바꿀 수 있어요. | 0,71 | 20,159 | 372×40 | T03 | 표시 (부모 clip 적용) |
| `590:2303` | 선호 음식 종류 | 23,0 | 60,236 | 91×23 | T04 | 표시 (부모 clip 적용) |
| `590:2302` | 01 | 0,2 | 37,238 | 15×19 | T01 | 표시 (부모 clip 적용) |
| `590:2304` | 여러 개 골라도 돼요 · ‘상관없음’을 고르면 나머지는 해제돼요 | 0,25 | 37,261 | 306×19 | T05 | 표시 (부모 clip 적용) |
| `I590:2306;493:1040` | 한식 | 17,12 | 54,304 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2307;493:1040` | 일식 | 17,12 | 120,304 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2308;493:1040` | 중식 | 17,12 | 186,304 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2309;493:1040` | 양식 | 17,12 | 252,304 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2310;493:1040` | 동남아 | 17,12 | 318,304 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2311;493:1040` | 기타 세계음식 | 17,12 | 54,356 | 76×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2312;493:1040` | 분식 | 17,12 | 172,356 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2313;493:1044` | 상관없음 | 35.5,12 | 256.5,356 | 48×20 | T06 | 표시 (부모 clip 적용) |
| `590:2318` | 선호 주재료 | 24,0 | 61,434 | 73×23 | T04 | 표시 (부모 clip 적용) |
| `590:2317` | 02 | 0,2 | 37,436 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `590:2319` | 여러 개 골라도 돼요 | 0,25 | 37,459 | 99×19 | T05 | 표시 (부모 clip 적용) |
| `590:2320` | 육류 | 17,73 | 37,490 | 23×19 | T08 | 표시 (부모 clip 적용) |
| `I590:2322;493:1040` | 소고기 | 17,12 | 54,533 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2323;493:1044` | 돼지고기 | 35.5,12 | 150.5,533 | 48×20 | T06 | 표시 (부모 clip 적용) |
| `I590:2324;493:1044` | 닭고기 | 35.5,12 | 259.5,533 | 36×20 | T06 | 표시 (부모 clip 적용) |
| `I590:2325;493:1040` | 양고기 | 17,12 | 54,585 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `590:2326` | 해산물 | 17,212 | 37,629 | 34×19 | T08 | 표시 (부모 clip 적용) |
| `I590:2328;493:1040` | 생선 | 17,12 | 54,672 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2329;493:1040` | 새우·게 등 갑각류 | 17,12 | 120,672 | 98×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2330;493:1040` | 조개류 | 17,12 | 260,672 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2331;493:1040` | 오징어·문어 | 17,12 | 54,724 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `590:2332` | 기타 | 17,351 | 37,768 | 23×19 | T08 | 표시 (부모 clip 적용) |
| `I590:2334;493:1040` | 계란 | 17,12 | 54,811 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2335;493:1040` | 두부·콩 | 17,12 | 120,811 | 43×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2336;493:1040` | 채소 | 17,12 | 205,811 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2337;493:1040` | 치즈·유제품 | 17,12 | 271,811 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2367;493:1047` | 다음 | 172,15 | 192,832 | 28×22 | T09 | 표시 (부모 clip 적용) |
| `590:2342` | 선호 음식 형태 | 24,0 | 61,889 | 91×23 | T04 | 표시 (부모 clip 적용) |
| `590:2341` | 03 | 0,2 | 37,891 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `590:2343` | 여러 개 골라도 돼요 | 0,25 | 37,914 | 99×19 | T05 | 표시 (부모 clip 적용) |
| `I590:2345;493:1040` | 밥 | 17,12 | 54,957 | 12×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2346;493:1044` | 면 | 35.5,12 | 126.5,957 | 12×20 | T06 | 표시 (부모 clip 적용) |
| `I590:2347;493:1044` | 국물·탕 | 35.5,12 | 199.5,957 | 43×20 | T06 | 표시 (부모 clip 적용) |
| `I590:2348;493:1040` | 찌개·전골 | 17,12 | 285,957 | 55×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2349;493:1044` | 구이 | 35.5,12 | 72.5,1009 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I590:2350;493:1040` | 튀김 | 17,12 | 139,1009 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2351;493:1040` | 볶음 | 17,12 | 205,1009 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2352;493:1040` | 찜 | 17,12 | 271,1009 | 12×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2353;493:1040` | 샐러드·가벼운 식사 | 17,12 | 54,1061 | 107×20 | T07 | 표시 (부모 clip 적용) |
| `590:2358` | 매운맛 선호도 | 25,0 | 62,1139 | 87×23 | T04 | 표시 (부모 clip 적용) |
| `590:2357` | 04 | 0,2 | 37,1141 | 17×19 | T01 | 표시 (부모 clip 적용) |
| `590:2359` | 하나만 골라 주세요 | 0,25 | 37,1164 | 96×19 | T05 | 표시 (부모 clip 적용) |
| `I590:2361;493:1055` | 전혀 못 먹음 | 32,12 | 69,1207 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2362;493:1055` | 조금 매운 정도 | 32,12 | 69,1251 | 79×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2363;493:1058` | 보통 | 32,12 | 69,1295 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I590:2364;493:1055` | 매운 음식 좋아함 | 32,12 | 69,1339 | 91×20 | T07 | 표시 (부모 clip 적용) |
| `I590:2365;493:1055` | 아주 매운 음식도 좋아함 | 32,12 | 69,1383 | 131×20 | T07 | 표시 (부모 clip 적용) |

#### 선택지 전체와 현재 상태

| 범주 | 라벨 원문 | 노드 | 방식·배타 규칙 | 현재 variant |
|---|---|---|---|---|
| 음식 종류 | 한식 | `590:2306` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 일식 | `590:2307` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 중식 | `590:2308` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 양식 | `590:2309` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 동남아 | `590:2310` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 기타 세계음식 | `590:2311` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 분식 | `590:2312` | 복수 / 상관없음 배타 | Default |
| 음식 종류 | 상관없음 | `590:2313` | 복수 / 상관없음 배타 | Selected |
| 주재료 | 소고기 | `590:2322` | 복수 | Default |
| 주재료 | 돼지고기 | `590:2323` | 복수 | Selected |
| 주재료 | 닭고기 | `590:2324` | 복수 | Selected |
| 주재료 | 양고기 | `590:2325` | 복수 | Default |
| 주재료 | 생선 | `590:2328` | 복수 | Default |
| 주재료 | 새우·게 등 갑각류 | `590:2329` | 복수 | Default |
| 주재료 | 조개류 | `590:2330` | 복수 | Default |
| 주재료 | 오징어·문어 | `590:2331` | 복수 | Default |
| 주재료 | 계란 | `590:2334` | 복수 | Default |
| 주재료 | 두부·콩 | `590:2335` | 복수 | Default |
| 주재료 | 채소 | `590:2336` | 복수 | Default |
| 주재료 | 치즈·유제품 | `590:2337` | 복수 | Default |
| 음식 형태 | 밥 | `590:2345` | 복수 | Default |
| 음식 형태 | 면 | `590:2346` | 복수 | Selected |
| 음식 형태 | 국물·탕 | `590:2347` | 복수 | Selected |
| 음식 형태 | 찌개·전골 | `590:2348` | 복수 | Default |
| 음식 형태 | 구이 | `590:2349` | 복수 | Selected |
| 음식 형태 | 튀김 | `590:2350` | 복수 | Default |
| 음식 형태 | 볶음 | `590:2351` | 복수 | Default |
| 음식 형태 | 찜 | `590:2352` | 복수 | Default |
| 음식 형태 | 샐러드·가벼운 식사 | `590:2353` | 복수 | Default |
| 매운맛 | 전혀 못 먹음 | `590:2361` | 단일 | Off |
| 매운맛 | 조금 매운 정도 | `590:2362` | 단일 | Off |
| 매운맛 | 보통 | `590:2363` | 단일 | On |
| 매운맛 | 매운 음식 좋아함 | `590:2364` | 단일 | Off |
| 매운맛 | 아주 매운 음식도 좋아함 | `590:2365` | 단일 | Off |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `590:2285` Back | BACK | 이전 프레임 |
| `590:2306` 한식 | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |
| `590:2307` 일식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2308` 중식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2309` 양식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2310` 동남아 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2311` 기타 세계음식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2312` 분식 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2313` 상관없음 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `590:2322` 소고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2323` 돼지고기 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `590:2324` 닭고기 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `590:2325` 양고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2328` 생선 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2329` 새우·게 등 갑각류 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2330` 조개류 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2331` 오징어·문어 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2334` 계란 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2335` 두부·콩 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2336` 채소 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2337` 치즈·유제품 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2345` 밥 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2346` 면 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `590:2347` 국물·탕 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `590:2348` 찌개·전골 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2349` 구이 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `590:2350` 튀김 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2351` 볶음 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2352` 찜 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2353` 샐러드·가벼운 식사 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `590:2361` 전혀 못 먹음 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `590:2362` 조금 매운 정도 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `590:2364` 매운 음식 좋아함 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `590:2365` 아주 매운 음식도 좋아함 | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `590:2367` 다음 | NAVIGATE | [495:1163](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1163) 가입/음식 프로필 STEP 2 · 알레르기 |

### 3.3 가입/음식 프로필 STEP 2 · 알레르기

노드 [495:1163](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1163), 크기 412×892, 섹션 내 배치 (1064,120). 비벡터 하위 노드 및 루트 82개를 추출했다.

05 알레르기 펼침, 06·07 접힘. 알레르기 17개(기타/없음 포함) 복수 선택, ‘알레르기 없음’은 배타다. 새우가 Selected이고 나머지는 Default다. 접힌 06·07은 ‘아직 고르지 않았어요’다. 알레르기 없음 선택 후 다른 항목을 누를 때 없음이 해제된다는 것은 주석 499:1244의 ‘같은 규칙’과 배타 의도에 따른 해석이며 별도 조합 화면은 없다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `495:1163` 가입/음식 프로필 STEP 2 · 알레르기 (FRAME) | 섹션 | 1064,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `495:1164` Header (FRAME) | 495:1163 | 0,0 | 0,0 | 412×219 | V gap12 cross0 pad16/20/20/20; clip |
| `495:1165` Top Bar (FRAME) | 495:1164 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1166` Back (FRAME) | 495:1165 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1167` Frame (FRAME) | 495:1166 | 0,10 | 20,26 | 24×24 | fill #ffffff (직접값); clip |
| `495:1170` Progress (FRAME) | 495:1164 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0; clip |
| `495:1171` Rectangle (RECTANGLE) | 495:1170 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `495:1172` Rectangle (RECTANGLE) | 495:1170 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1526` Rectangle (RECTANGLE) | 495:1170 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1527` Rectangle (RECTANGLE) | 495:1170 | 283.5,0 | 303.5,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `495:1173` Title (FRAME) | 495:1164 | 20,88 | 20,88 | 372×111 | V gap6 cross0 pad8/0/0/0; clip |
| `495:1176` Body (FRAME) | 495:1163 | 0,219 | 0,219 | 412×673 | V gap12 cross0 pad0/20/8/20; scroll VERTICAL; clip |
| `495:1180` Accordion 05 (FRAME) | 495:1176 | 20,0 | 20,219 | 372×467 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #ff9900 (color/primary); clip; radius16; strokeWidth1.5 |
| `495:1181` Accordion Header (FRAME) | 495:1180 | 1.5,1.5 | 21.5,220.5 | 369×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1183` Frame (FRAME) | 495:1181 | 44,14 | 65.5,234.5 | 277×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1186` Frame (FRAME) | 495:1181 | 333,26 | 354.5,246.5 | 20×20 | fill #ffffff (직접값); clip |
| `495:1188` Accordion Body (FRAME) | 495:1180 | 1.5,73.5 | 21.5,292.5 | 369×392 | V gap12 cross0 pad4/16/16/16; clip |
| `495:1190` Chips (FRAME) | 495:1188 | 16,35 | 37.5,327.5 | 337×252 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1191` Chip (INSTANCE) | 495:1190 | 0,0 | 37.5,327.5 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=계란; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1193` Chip (INSTANCE) | 495:1190 | 66,0 | 103.5,327.5 | 101×44 | H gap4 cross0 pad0/16/0/16; Label=우유·유제품; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1195` Chip (INSTANCE) | 495:1190 | 175,0 | 212.5,327.5 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=땅콩; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1197` Chip (INSTANCE) | 495:1190 | 241,0 | 278.5,327.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=견과류; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1199` Chip (INSTANCE) | 495:1190 | 0,52 | 37.5,379.5 | 46×44 | H gap4 cross0 pad0/16/0/16; Label=밀; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1201` Chip (INSTANCE) | 495:1190 | 54,52 | 91.5,379.5 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=메밀; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1203` Chip (INSTANCE) | 495:1190 | 120,52 | 157.5,379.5 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=대두·콩; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1205` Chip (INSTANCE) | 495:1190 | 205,52 | 242.5,379.5 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=생선; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1207` Chip (INSTANCE) | 495:1190 | 0,104 | 37.5,431.5 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=새우; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1211` Chip (INSTANCE) | 495:1190 | 85,104 | 122.5,431.5 | 46×44 | H gap4 cross0 pad0/16/0/16; Label=게; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1213` Chip (INSTANCE) | 495:1190 | 139,104 | 176.5,431.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=조개류; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1215` Chip (INSTANCE) | 495:1190 | 217,104 | 254.5,431.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=오징어; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I495:1207;493:1042` icon/check (FRAME) | 495:1207 | 17.5,15 | 55,446.5 | 14×14 | fill #ffffff (직접값); clip |
| `495:1217` Chip (INSTANCE) | 495:1190 | 0,156 | 37.5,483.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=소고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1219` Chip (INSTANCE) | 495:1190 | 78,156 | 115.5,483.5 | 82×44 | H gap4 cross0 pad0/16/0/16; Label=돼지고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1221` Chip (INSTANCE) | 495:1190 | 168,156 | 205.5,483.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=닭고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1223` Chip (INSTANCE) | 495:1190 | 0,208 | 37.5,535.5 | 113×44 | H gap4 cross0 pad0/16/0/16; Label=기타 직접 입력; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1225` Chip (INSTANCE) | 495:1190 | 121,208 | 158.5,535.5 | 110×44 | H gap4 cross0 pad0/16/0/16; Label=알레르기 없음; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1227` Notice (FRAME) | 495:1188 | 16,299 | 37.5,591.5 | 337×77 | H gap8 cross0 pad10/12/10/12; fill #f1eee9 (color/muted-bg); clip; radius10 |
| `495:1228` Frame (FRAME) | 495:1227 | 12,10 | 49.5,601.5 | 16×16 | fill #ffffff (직접값); clip |
| `495:1232` Accordion 06 (FRAME) | 495:1176 | 20,479 | 20,698 | 372×74 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1233` Accordion Header (FRAME) | 495:1232 | 1,1 | 21,699 | 370×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1235` Frame (FRAME) | 495:1233 | 44,14 | 65,713 | 278×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1238` Frame (FRAME) | 495:1233 | 334,26 | 355,725 | 20×20 | fill #ffffff (직접값); clip |
| `495:1240` Accordion 07 (FRAME) | 495:1176 | 20,565 | 20,784 | 372×74 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1241` Accordion Header (FRAME) | 495:1240 | 1,1 | 21,785 | 370×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1243` Frame (FRAME) | 495:1241 | 44,14 | 65,799 | 278×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1177` Footer (FRAME) | 495:1163 | 0,804 | 0,804 | 412×88 | V gap0 cross0 pad12/20/0/20; fill #f8f6f2 (color/bg); stroke #e8e3dc (color/border); clip; strokeWidthnull; ABSOLUTE |
| `495:1246` Frame (FRAME) | 495:1241 | 334,26 | 355,811 | 20×20 | fill #ffffff (직접값); clip |
| `495:1178` CTA (INSTANCE) | 495:1177 | 20,13 | 20,817 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=다음; Kind=Primary; fill #ff9900 (color/primary); radius14 |
| `667:12745` Bottom Spacer (FRAME) | 495:1176 | 20,651 | 20,870 | 372×92 | clip |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `495:1169` | STEP 3 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `539:1528` | 음식 프로필 2 / 2 · 피해야 할 음식 | 0,8 | 20,96 | 175×19 | T01 | 표시 (부모 clip 적용) |
| `495:1174` | 피해야 할 음식이 있나요? | 0,33 | 20,121 | 217×32 | T02 | 표시 (부모 clip 적용) |
| `495:1175` | 메뉴 추천에서 빼야 할 음식을 알려 주세요. 다른 멤버에게는 보이지 않아요. | 0,71 | 20,159 | 372×40 | T03 | 표시 (부모 clip 적용) |
| `495:1184` | 알레르기 | 0,0 | 65.5,234.5 | 55×23 | T04 | 표시 (부모 clip 적용) |
| `495:1182` | 05 | 16,26.5 | 37.5,247 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1185` | 새우 | 0,25 | 65.5,259.5 | 23×19 | T10 | 표시 (부모 clip 적용) |
| `495:1189` | 여러 개 골라도 돼요 · "알레르기 없음"을 고르면 나머지는 해제돼요 | 16,4 | 37.5,296.5 | 337×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1191;493:1040` | 계란 | 17,12 | 54.5,339.5 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1193;493:1040` | 우유·유제품 | 17,12 | 120.5,339.5 | 67×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1195;493:1040` | 땅콩 | 17,12 | 229.5,339.5 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1197;493:1040` | 견과류 | 17,12 | 295.5,339.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1199;493:1040` | 밀 | 17,12 | 54.5,391.5 | 12×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1201;493:1040` | 메밀 | 17,12 | 108.5,391.5 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1203;493:1040` | 대두·콩 | 17,12 | 174.5,391.5 | 43×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1205;493:1040` | 생선 | 17,12 | 259.5,391.5 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1207;493:1044` | 새우 | 35.5,12 | 73,443.5 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1211;493:1040` | 게 | 17,12 | 139.5,443.5 | 12×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1213;493:1040` | 조개류 | 17,12 | 193.5,443.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1215;493:1040` | 오징어 | 17,12 | 271.5,443.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1217;493:1040` | 소고기 | 17,12 | 54.5,495.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1219;493:1040` | 돼지고기 | 17,12 | 132.5,495.5 | 48×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1221;493:1040` | 닭고기 | 17,12 | 222.5,495.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1223;493:1040` | 기타 직접 입력 | 17,12 | 54.5,547.5 | 79×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1225;493:1040` | 알레르기 없음 | 17,12 | 175.5,547.5 | 76×20 | T07 | 표시 (부모 clip 적용) |
| `495:1231` | 알레르기로 등록한 식재료가 들어간 메뉴는 추천 후보에서 빼요. 메뉴의 주재료 기준이라 소스·밑반찬까지는 확인할 수 없어요. 주문 전에 꼭 확인해 주세요. | 36,10 | 73.5,601.5 | 289×57 | T05 | 표시 (부모 clip 적용) |
| `495:1236` | 못 먹는 음식 | 0,0 | 65,713 | 77×23 | T04 | 표시 (부모 clip 적용) |
| `495:1234` | 06 | 16,26.5 | 37,725.5 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1237` | 아직 고르지 않았어요 | 0,25 | 65,738 | 107×19 | T05 | 표시 (부모 clip 적용) |
| `495:1244` | 식단 제한 | 0,0 | 65,799 | 59×23 | T04 | 표시 (부모 clip 적용) |
| `495:1242` | 07 | 16,26.5 | 37,811.5 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1245` | 아직 고르지 않았어요 | 0,25 | 65,824 | 107×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1178;493:1047` | 다음 | 172,15 | 192,832 | 28×22 | T09 | 표시 (부모 clip 적용) |

#### 선택지 전체와 현재 상태

| 범주 | 라벨 원문 | 노드 | 방식·배타 규칙 | 현재 variant |
|---|---|---|---|---|
| 알레르기 | 계란 | `495:1191` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 우유·유제품 | `495:1193` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 땅콩 | `495:1195` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 견과류 | `495:1197` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 밀 | `495:1199` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 메밀 | `495:1201` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 대두·콩 | `495:1203` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 생선 | `495:1205` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 새우 | `495:1207` | 복수 / 알레르기 없음 배타 | Selected |
| 알레르기 | 게 | `495:1211` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 조개류 | `495:1213` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 오징어 | `495:1215` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 소고기 | `495:1217` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 돼지고기 | `495:1219` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 닭고기 | `495:1221` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 기타 직접 입력 | `495:1223` | 복수 / 알레르기 없음 배타 | Default |
| 알레르기 | 알레르기 없음 | `495:1225` | 복수 / 알레르기 없음 배타 | Default |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `495:1166` Back | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |
| `495:1191` 계란 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1193` 우유·유제품 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1195` 땅콩 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1197` 견과류 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1199` 밀 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1201` 메밀 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1203` 대두·콩 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1205` 생선 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1207` 새우 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1211` 게 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1213` 조개류 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1215` 오징어 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1217` 소고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1219` 돼지고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1221` 닭고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1223` 기타 직접 입력 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1225` 알레르기 없음 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1233` Accordion Header | NAVIGATE | [495:1248](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1248) 가입/음식 프로필 STEP 2 · 못 먹는 음식 |
| `495:1241` Accordion Header | NAVIGATE | [495:1325](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1325) 가입/음식 프로필 STEP 2 · 식단 제한 |
| `495:1178` 다음 | NAVIGATE | [520:1285](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1285) 회원가입/약관 동의 |

### 3.4 가입/음식 프로필 STEP 2 · 못 먹는 음식

노드 [495:1248](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1248), 크기 412×892, 섹션 내 배치 (1596,120). 비벡터 하위 노드 및 루트 69개를 추출했다.

05 접힘(새우 요약), 06 펼침(회·날생선·내장 선택), 07 접힘(미입력). 못 먹는 음식 10개 복수 선택, ‘없음’은 배타다. ‘기타 직접 입력’은 칩만 있고 입력창/모달/키보드 연결은 없다. 이 그룹은 07의 추가로 피할 것과 별도다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `495:1248` 가입/음식 프로필 STEP 2 · 못 먹는 음식 (FRAME) | 섹션 | 1596,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `495:1249` Header (FRAME) | 495:1248 | 0,0 | 0,0 | 412×219 | V gap12 cross0 pad16/20/20/20; clip |
| `495:1250` Top Bar (FRAME) | 495:1249 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1251` Back (FRAME) | 495:1250 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1252` Frame (FRAME) | 495:1251 | 0,10 | 20,26 | 24×24 | fill #ffffff (직접값); clip |
| `495:1255` Progress (FRAME) | 495:1249 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0; clip |
| `495:1256` Rectangle (RECTANGLE) | 495:1255 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `495:1257` Rectangle (RECTANGLE) | 495:1255 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1529` Rectangle (RECTANGLE) | 495:1255 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1530` Rectangle (RECTANGLE) | 495:1255 | 283.5,0 | 303.5,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `495:1258` Title (FRAME) | 495:1249 | 20,88 | 20,88 | 372×111 | V gap6 cross0 pad8/0/0/0; clip |
| `495:1261` Body (FRAME) | 495:1248 | 0,219 | 0,219 | 412×673 | V gap12 cross0 pad0/20/8/20; scroll VERTICAL; clip |
| `495:1265` Accordion 05 (FRAME) | 495:1261 | 20,0 | 20,219 | 372×74 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1266` Accordion Header (FRAME) | 495:1265 | 1,1 | 21,220 | 370×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1268` Frame (FRAME) | 495:1266 | 44,14 | 65,234 | 278×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1271` Frame (FRAME) | 495:1266 | 334,26 | 355,246 | 20×20 | fill #ffffff (직접값); clip |
| `495:1273` Accordion 06 (FRAME) | 495:1261 | 20,86 | 20,305 | 372×363 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #ff9900 (color/primary); clip; radius16; strokeWidth1.5 |
| `495:1274` Accordion Header (FRAME) | 495:1273 | 1.5,1.5 | 21.5,306.5 | 369×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1276` Frame (FRAME) | 495:1274 | 44,14 | 65.5,320.5 | 277×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1279` Frame (FRAME) | 495:1274 | 333,26 | 354.5,332.5 | 20×20 | fill #ffffff (직접값); clip |
| `495:1281` Accordion Body (FRAME) | 495:1273 | 1.5,73.5 | 21.5,378.5 | 369×288 | V gap12 cross0 pad4/16/16/16; clip |
| `495:1283` Chips (FRAME) | 495:1281 | 16,35 | 37.5,413.5 | 337×148 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1284` Chip (INSTANCE) | 495:1283 | 0,0 | 37.5,413.5 | 108×44 | H gap4 cross0 pad0/16/0/16; Label=회·날생선; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1288` Chip (INSTANCE) | 495:1283 | 116,0 | 153.5,413.5 | 77×44 | H gap4 cross0 pad0/16/0/16; Label=내장; State=Selected; fill #fff3e0 (color/selected-bg); stroke #ff9900 (color/primary); radius22; strokeWidth1.5 |
| `495:1292` Chip (INSTANCE) | 495:1283 | 201,0 | 238.5,413.5 | 89×44 | H gap4 cross0 pad0/16/0/16; Label=곱창·막창; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `I495:1284;493:1042` icon/check (FRAME) | 495:1284 | 17.5,15 | 55,428.5 | 14×14 | fill #ffffff (직접값); clip |
| `I495:1288;493:1042` icon/check (FRAME) | 495:1288 | 17.5,15 | 171,428.5 | 14×14 | fill #ffffff (직접값); clip |
| `495:1294` Chip (INSTANCE) | 495:1283 | 0,52 | 37.5,465.5 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=고수; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1300` Chip (INSTANCE) | 495:1283 | 66,52 | 103.5,465.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=소고기; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1302` Chip (INSTANCE) | 495:1283 | 144,52 | 181.5,465.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=해산물; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1304` Chip (INSTANCE) | 495:1283 | 222,52 | 259.5,465.5 | 70×44 | H gap4 cross0 pad0/16/0/16; Label=유제품; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1306` Chip (INSTANCE) | 495:1283 | 0,104 | 37.5,517.5 | 86×44 | H gap4 cross0 pad0/16/0/16; Label=육류 전체; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1308` Chip (INSTANCE) | 495:1283 | 94,104 | 131.5,517.5 | 113×44 | H gap4 cross0 pad0/16/0/16; Label=기타 직접 입력; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1310` Chip (INSTANCE) | 495:1283 | 215,104 | 252.5,517.5 | 58×44 | H gap4 cross0 pad0/16/0/16; Label=없음; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1312` Notice (FRAME) | 495:1281 | 16,195 | 37.5,573.5 | 337×77 | H gap8 cross0 pad10/12/10/12; fill #f1eee9 (color/muted-bg); clip; radius10 |
| `495:1313` Frame (FRAME) | 495:1312 | 12,10 | 49.5,583.5 | 16×16 | fill #ffffff (직접값); clip |
| `495:1317` Accordion 07 (FRAME) | 495:1261 | 20,461 | 20,680 | 372×74 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1318` Accordion Header (FRAME) | 495:1317 | 1,1 | 21,681 | 370×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1320` Frame (FRAME) | 495:1318 | 44,14 | 65,695 | 278×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1323` Frame (FRAME) | 495:1318 | 334,26 | 355,707 | 20×20 | fill #ffffff (직접값); clip |
| `667:12746` Bottom Spacer (FRAME) | 495:1261 | 20,547 | 20,766 | 372×92 | clip |
| `495:1262` Footer (FRAME) | 495:1248 | 0,804 | 0,804 | 412×88 | V gap0 cross0 pad12/20/0/20; fill #f8f6f2 (color/bg); stroke #e8e3dc (color/border); clip; strokeWidthnull; ABSOLUTE |
| `495:1263` CTA (INSTANCE) | 495:1262 | 20,13 | 20,817 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=다음; Kind=Primary; fill #ff9900 (color/primary); radius14 |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `495:1254` | STEP 3 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `539:1531` | 음식 프로필 2 / 2 · 피해야 할 음식 | 0,8 | 20,96 | 175×19 | T01 | 표시 (부모 clip 적용) |
| `495:1259` | 피해야 할 음식이 있나요? | 0,33 | 20,121 | 217×32 | T02 | 표시 (부모 clip 적용) |
| `495:1260` | 메뉴 추천에서 빼야 할 음식을 알려 주세요. 다른 멤버에게는 보이지 않아요. | 0,71 | 20,159 | 372×40 | T03 | 표시 (부모 clip 적용) |
| `495:1269` | 알레르기 | 0,0 | 65,234 | 55×23 | T04 | 표시 (부모 clip 적용) |
| `495:1267` | 05 | 16,26.5 | 37,246.5 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1270` | 새우 | 0,25 | 65,259 | 23×19 | T10 | 표시 (부모 clip 적용) |
| `495:1277` | 못 먹는 음식 | 0,0 | 65.5,320.5 | 77×23 | T04 | 표시 (부모 clip 적용) |
| `495:1275` | 06 | 16,26.5 | 37.5,333 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1278` | 회·날생선, 내장 | 0,25 | 65.5,345.5 | 81×19 | T10 | 표시 (부모 clip 적용) |
| `495:1282` | 여러 개 골라도 돼요 · "없음"을 고르면 나머지는 해제돼요 | 16,4 | 37.5,382.5 | 337×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1284;493:1044` | 회·날생선 | 35.5,12 | 73,425.5 | 55×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1288;493:1044` | 내장 | 35.5,12 | 189,425.5 | 24×20 | T06 | 표시 (부모 clip 적용) |
| `I495:1292;493:1040` | 곱창·막창 | 17,12 | 255.5,425.5 | 55×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1294;493:1040` | 고수 | 17,12 | 54.5,477.5 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1300;493:1040` | 소고기 | 17,12 | 120.5,477.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1302;493:1040` | 해산물 | 17,12 | 198.5,477.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1304;493:1040` | 유제품 | 17,12 | 276.5,477.5 | 36×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1306;493:1040` | 육류 전체 | 17,12 | 54.5,529.5 | 52×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1308;493:1040` | 기타 직접 입력 | 17,12 | 148.5,529.5 | 79×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1310;493:1040` | 없음 | 17,12 | 269.5,529.5 | 24×20 | T07 | 표시 (부모 clip 적용) |
| `495:1316` | 알레르기는 아니지만 피하고 싶은 음식이에요. 고른 항목이 들어간 메뉴는 추천에서 빼거나 우선순위를 크게 낮춰요. | 36,10 | 73.5,583.5 | 289×57 | T05 | 표시 (부모 clip 적용) |
| `495:1321` | 식단 제한 | 0,0 | 65,695 | 59×23 | T04 | 표시 (부모 clip 적용) |
| `495:1319` | 07 | 16,26.5 | 37,707.5 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1322` | 아직 고르지 않았어요 | 0,25 | 65,720 | 107×19 | T05 | 표시 (부모 clip 적용) |
| `I495:1263;493:1047` | 다음 | 172,15 | 192,832 | 28×22 | T09 | 표시 (부모 clip 적용) |

#### 선택지 전체와 현재 상태

| 범주 | 라벨 원문 | 노드 | 방식·배타 규칙 | 현재 variant |
|---|---|---|---|---|
| 못 먹는 음식 | 회·날생선 | `495:1284` | 복수 / 없음 배타 | Selected |
| 못 먹는 음식 | 내장 | `495:1288` | 복수 / 없음 배타 | Selected |
| 못 먹는 음식 | 곱창·막창 | `495:1292` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 고수 | `495:1294` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 소고기 | `495:1300` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 해산물 | `495:1302` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 유제품 | `495:1304` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 육류 전체 | `495:1306` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 기타 직접 입력 | `495:1308` | 복수 / 없음 배타 | Default |
| 못 먹는 음식 | 없음 | `495:1310` | 복수 / 없음 배타 | Default |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `495:1251` Back | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |
| `495:1266` Accordion Header | NAVIGATE | [495:1163](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1163) 가입/음식 프로필 STEP 2 · 알레르기 |
| `495:1284` 회·날생선 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1288` 내장 | CHANGE_TO | [493:1039](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1039) Chip Default |
| `495:1292` 곱창·막창 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1294` 고수 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1300` 소고기 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1302` 해산물 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1304` 유제품 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1306` 육류 전체 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1308` 기타 직접 입력 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1310` 없음 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1318` Accordion Header | NAVIGATE | [495:1325](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1325) 가입/음식 프로필 STEP 2 · 식단 제한 |
| `495:1263` 다음 | NAVIGATE | [520:1285](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1285) 회원가입/약관 동의 |

### 3.5 가입/음식 프로필 STEP 2 · 식단 제한

노드 [495:1325](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1325), 크기 412×892, 섹션 내 배치 (2128,120). 비벡터 하위 노드 및 루트 66개를 추출했다.

05·06 접힘(새우 / 회·날생선, 내장 요약), 07 펼침. 식단 유형 4개는 Radio 단일 선택, ‘식단 제한 없음’이 On이다. ‘추가로 피할 것’ 2개는 Chip 복수 선택이며 둘 다 Default다. ‘식단 제한 없음’과 추가 회피의 상호 배타 규칙은 명시되지 않았다. 주석상 식단 유형 하나 + 추가 여러 개라는 두 그룹 구조이므로 ‘없음’을 눌러 추가 회피까지 지운다고 추정하지 않는다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `495:1325` 가입/음식 프로필 STEP 2 · 식단 제한 (FRAME) | 섹션 | 2128,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `495:1326` Header (FRAME) | 495:1325 | 0,0 | 0,0 | 412×219 | V gap12 cross0 pad16/20/20/20; clip |
| `495:1327` Top Bar (FRAME) | 495:1326 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1328` Back (FRAME) | 495:1327 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0; clip |
| `495:1329` Frame (FRAME) | 495:1328 | 0,10 | 20,26 | 24×24 | fill #ffffff (직접값); clip |
| `495:1332` Progress (FRAME) | 495:1326 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0; clip |
| `495:1333` Rectangle (RECTANGLE) | 495:1332 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `495:1334` Rectangle (RECTANGLE) | 495:1332 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1532` Rectangle (RECTANGLE) | 495:1332 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `539:1533` Rectangle (RECTANGLE) | 495:1332 | 283.5,0 | 303.5,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `495:1335` Title (FRAME) | 495:1326 | 20,88 | 20,88 | 372×111 | V gap6 cross0 pad8/0/0/0; clip |
| `495:1338` Body (FRAME) | 495:1325 | 0,219 | 0,219 | 412×673 | V gap12 cross0 pad0/20/8/20; scroll VERTICAL; clip |
| `495:1342` Accordion 05 (FRAME) | 495:1338 | 20,0 | 20,219 | 372×74 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1343` Accordion Header (FRAME) | 495:1342 | 1,1 | 21,220 | 370×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1345` Frame (FRAME) | 495:1343 | 44,14 | 65,234 | 278×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1348` Frame (FRAME) | 495:1343 | 334,26 | 355,246 | 20×20 | fill #ffffff (직접값); clip |
| `495:1350` Accordion 06 (FRAME) | 495:1338 | 20,86 | 20,305 | 372×74 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip; radius16; strokeWidth1 |
| `495:1351` Accordion Header (FRAME) | 495:1350 | 1,1 | 21,306 | 370×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1353` Frame (FRAME) | 495:1351 | 44,14 | 65,320 | 278×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1356` Frame (FRAME) | 495:1351 | 334,26 | 355,332 | 20×20 | fill #ffffff (직접값); clip |
| `495:1358` Accordion 07 (FRAME) | 495:1338 | 20,172 | 20,391 | 372×490 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #ff9900 (color/primary); clip; radius16; strokeWidth1.5 |
| `495:1359` Accordion Header (FRAME) | 495:1358 | 1.5,1.5 | 21.5,392.5 | 369×72 | H gap12 cross0 pad14/16/14/16; clip |
| `495:1361` Frame (FRAME) | 495:1359 | 44,14 | 65.5,406.5 | 277×44 | V gap2 cross0 pad0/0/0/0; clip |
| `495:1364` Frame (FRAME) | 495:1359 | 333,26 | 354.5,418.5 | 20×20 | fill #ffffff (직접값); clip |
| `495:1366` Accordion Body (FRAME) | 495:1358 | 1.5,73.5 | 21.5,464.5 | 369×415 | V gap12 cross0 pad4/16/16/16; clip |
| `557:1653` Radios 식단 유형 (FRAME) | 495:1366 | 16,66 | 37.5,530.5 | 337×176 | V gap0 cross0 pad0/0/0/0; clip |
| `557:1654` Radio (INSTANCE) | 557:1653 | 0,0 | 37.5,530.5 | 337×44 | H gap12 cross0 pad0/0/0/0; Label=식단 제한 없음; State=On |
| `I557:1654;493:1057` dot (ELLIPSE) | 557:1654 | 0,12 | 37.5,542.5 | 20×20 | fill #ffffff (color/surface); stroke #ff9900 (color/primary) |
| `557:1657` Radio (INSTANCE) | 557:1653 | 0,44 | 37.5,574.5 | 337×44 | H gap12 cross0 pad0/0/0/0; Label=채식 (고기 · 생선을 먹지 않음); State=Off |
| `I557:1657;493:1054` dot (ELLIPSE) | 557:1657 | 0,12 | 37.5,586.5 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `557:1660` Radio (INSTANCE) | 557:1653 | 0,88 | 37.5,618.5 | 337×44 | H gap12 cross0 pad0/0/0/0; Label=비건 (동물성 음식을 먹지 않음); State=Off |
| `I557:1660;493:1054` dot (ELLIPSE) | 557:1660 | 0,12 | 37.5,630.5 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `557:1663` Radio (INSTANCE) | 557:1653 | 0,132 | 37.5,662.5 | 337×44 | H gap12 cross0 pad0/0/0/0; Label=페스코 (생선 · 해산물은 먹음); State=Off |
| `I557:1663;493:1054` dot (ELLIPSE) | 557:1663 | 0,12 | 37.5,674.5 | 20×20 | fill #ffffff (color/surface); stroke #c8c3bc (직접값) |
| `495:1368` Chips 추가로 피할 것 (FRAME) | 495:1366 | 16,285 | 37.5,749.5 | 337×44 | H gap8 cross8 pad0/0/0/0; clip; WRAP |
| `495:1375` Chip (INSTANCE) | 495:1368 | 0,0 | 37.5,749.5 | 110×44 | H gap4 cross0 pad0/16/0/16; Label=돼지고기 제외; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1377` Chip (INSTANCE) | 495:1368 | 118,0 | 155.5,749.5 | 113×44 | H gap4 cross0 pad0/16/0/16; Label=기타 직접 입력; State=Default; fill #ffffff (color/surface); stroke #e8e3dc (color/border); radius22; strokeWidth1 |
| `495:1339` Footer (FRAME) | 495:1325 | 0,804 | 0,804 | 412×88 | V gap0 cross0 pad12/20/0/20; fill #f8f6f2 (color/bg); stroke #e8e3dc (color/border); clip; strokeWidthnull; ABSOLUTE |
| `495:1383` Notice (FRAME) | 495:1366 | 16,341 | 37.5,805.5 | 337×58 | H gap8 cross0 pad10/12/10/12; fill #f1eee9 (color/muted-bg); clip; radius10 |
| `495:1384` Frame (FRAME) | 495:1383 | 12,10 | 49.5,815.5 | 16×16 | fill #ffffff (직접값); clip |
| `495:1340` CTA (INSTANCE) | 495:1339 | 20,13 | 20,817 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=다음; Kind=Primary; fill #ff9900 (color/primary); radius14 |
| `667:12747` Bottom Spacer (FRAME) | 495:1338 | 20,674 | 20,893 | 372×92 | clip |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `495:1331` | STEP 3 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `539:1534` | 음식 프로필 2 / 2 · 피해야 할 음식 | 0,8 | 20,96 | 175×19 | T01 | 표시 (부모 clip 적용) |
| `495:1336` | 피해야 할 음식이 있나요? | 0,33 | 20,121 | 217×32 | T02 | 표시 (부모 clip 적용) |
| `495:1337` | 메뉴 추천에서 빼야 할 음식을 알려 주세요. 다른 멤버에게는 보이지 않아요. | 0,71 | 20,159 | 372×40 | T03 | 표시 (부모 clip 적용) |
| `495:1346` | 알레르기 | 0,0 | 65,234 | 55×23 | T04 | 표시 (부모 clip 적용) |
| `495:1344` | 05 | 16,26.5 | 37,246.5 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1347` | 새우 | 0,25 | 65,259 | 23×19 | T10 | 표시 (부모 clip 적용) |
| `495:1354` | 못 먹는 음식 | 0,0 | 65,320 | 77×23 | T04 | 표시 (부모 clip 적용) |
| `495:1352` | 06 | 16,26.5 | 37,332.5 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1355` | 회·날생선, 내장 | 0,25 | 65,345 | 81×19 | T10 | 표시 (부모 clip 적용) |
| `495:1362` | 식단 제한 | 0,0 | 65.5,406.5 | 59×23 | T04 | 표시 (부모 clip 적용) |
| `495:1360` | 07 | 16,26.5 | 37.5,419 | 16×19 | T01 | 표시 (부모 clip 적용) |
| `495:1363` | 식단 제한 없음 | 0,25 | 65.5,431.5 | 74×19 | T10 | 표시 (부모 clip 적용) |
| `495:1367` | 식단 유형은 하나만, 추가로 피할 것은 여러 개 고를 수 있어요 | 16,4 | 37.5,468.5 | 337×19 | T05 | 표시 (부모 clip 적용) |
| `557:1652` | 식단 유형 (하나만) | 16,35 | 37.5,499.5 | 337×19 | T08 | 표시 (부모 clip 적용) |
| `I557:1654;493:1058` | 식단 제한 없음 | 32,12 | 69.5,542.5 | 79×20 | T06 | 표시 (부모 clip 적용) |
| `I557:1657;493:1055` | 채식 (고기 · 생선을 먹지 않음) | 32,12 | 69.5,586.5 | 167×20 | T07 | 표시 (부모 clip 적용) |
| `I557:1660;493:1055` | 비건 (동물성 음식을 먹지 않음) | 32,12 | 69.5,630.5 | 169×20 | T07 | 표시 (부모 clip 적용) |
| `I557:1663;493:1055` | 페스코 (생선 · 해산물은 먹음) | 32,12 | 69.5,674.5 | 164×20 | T07 | 표시 (부모 clip 적용) |
| `557:1666` | 추가로 피할 것 (여러 개) | 16,254 | 37.5,718.5 | 337×19 | T08 | 표시 (부모 clip 적용) |
| `I495:1375;493:1040` | 돼지고기 제외 | 17,12 | 54.5,761.5 | 76×20 | T07 | 표시 (부모 clip 적용) |
| `I495:1377;493:1040` | 기타 직접 입력 | 17,12 | 172.5,761.5 | 79×20 | T07 | 표시 (부모 clip 적용) |
| `495:1387` | 페스코: 육류는 먹지 않지만 생선과 해산물은 먹는 식단이에요. 고른 식단과 맞지 않는 메뉴는 추천 후보에서 빼요. | 36,10 | 73.5,815.5 | 289×38 | T05 | 표시 (부모 clip 적용) |
| `I495:1340;493:1047` | 다음 | 172,15 | 192,832 | 28×22 | T09 | 표시 (부모 clip 적용) |

#### 선택지 전체와 현재 상태

| 범주 | 라벨 원문 | 노드 | 방식·배타 규칙 | 현재 variant |
|---|---|---|---|---|
| 식단 유형 | 식단 제한 없음 | `557:1654` | 단일 | On |
| 식단 유형 | 채식 (고기 · 생선을 먹지 않음) | `557:1657` | 단일 | Off |
| 식단 유형 | 비건 (동물성 음식을 먹지 않음) | `557:1660` | 단일 | Off |
| 식단 유형 | 페스코 (생선 · 해산물은 먹음) | `557:1663` | 단일 | Off |
| 추가로 피할 것 | 돼지고기 제외 | `495:1375` | 복수 | Default |
| 추가로 피할 것 | 기타 직접 입력 | `495:1377` | 복수 | Default |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `495:1328` Back | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |
| `495:1343` Accordion Header | NAVIGATE | [495:1163](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1163) 가입/음식 프로필 STEP 2 · 알레르기 |
| `495:1351` Accordion Header | NAVIGATE | [495:1248](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1248) 가입/음식 프로필 STEP 2 · 못 먹는 음식 |
| `557:1657` 채식 (고기 · 생선을 먹지 않음) | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `557:1660` 비건 (동물성 음식을 먹지 않음) | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `557:1663` 페스코 (생선 · 해산물은 먹음) | CHANGE_TO | [493:1056](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1056) Radio On |
| `495:1375` 돼지고기 제외 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1377` 기타 직접 입력 | CHANGE_TO | [493:1041](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=493-1041) Chip Selected |
| `495:1340` 다음 | NAVIGATE | [520:1285](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1285) 회원가입/약관 동의 |

### 3.6 프로필/프로필 홈

노드 [530:1403](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1403), 크기 412×892, 섹션 내 배치 (0,120). 비벡터 하위 노드 및 루트 102개를 추출했다.

음식 취향 매칭은 완료(초록 체크와 완료 텍스트)로 보이며 해당 Task에 클릭 연결이 없다. 메뉴의 음식 취향 다시 고르기만 STEP 1로 연결된다. 기존 사용자 미완료/재안내 상태는 이 프레임에 없다. 표시된 이름·생년월일은 Figma 예시 텍스트다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `530:1403` 프로필/프로필 홈 (FRAME) | 섹션 | 0,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `530:1404` AppHeader (INSTANCE) | 530:1403 | 0,0 | 0,0 | 412×60 | H gap0 cross0 pad0/8/0/20; Unread=true; fill #f8f6f2 (color/bg) |
| `I530:1404;518:1290` Bell (FRAME) | 530:1404 | 360,8 | 360,8 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I530:1404;518:1287` Brand (FRAME) | 530:1404 | 20,14 | 20,14 | 132×32 | H gap8 cross0 pad0/0/0/0 |
| `I530:1404;518:1288` logo (FRAME) | I530:1404;518:1287 | 0,0 | 20,14 | 32×32 | fill IMAGE; clip |
| `I530:1404;518:1291` icon/bell (FRAME) | I530:1404;518:1290 | 10,10 | 370,18 | 24×24 | clip |
| `I530:1404;518:1294` Unread (ELLIPSE) | I530:1404;518:1290 | 28,10 | 388,18 | 8×8 | fill #d93025 (직접값) |
| `I530:1404;518:1289` wordmark (FRAME) | I530:1404;518:1287 | 40,6 | 60,20 | 92×20 | fill IMAGE; clip |
| `530:1413` Body (FRAME) | 530:1403 | 0,60 | 0,60 | 412×832 | V gap14 cross0 pad4/20/8/20; scroll VERTICAL; clip |
| `530:1414` Profile (FRAME) | 530:1413 | 20,4 | 20,64 | 372×184 | V gap14 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `530:1415` Row (FRAME) | 530:1414 | 17,17 | 37,81 | 338×64 | H gap14 cross0 pad0/0/0/0 |
| `530:1416` dudu (FRAME) | 530:1415 | 0,0 | 37,81 | 64×64 | fill #fff3e0 (color/selected-bg), IMAGE; clip |
| `530:1417` Name (FRAME) | 530:1415 | 78,7 | 115,88 | 192×50 | V gap2 cross0 pad0/0/0/0 |
| `530:1420` 프로필 수정 (FRAME) | 530:1415 | 284,10 | 321,91 | 54×44 | H gap0 cross0 pad0/14/0/14; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `530:1422` Info (FRAME) | 530:1414 | 17,95 | 37,159 | 338×72 | V gap6 cross0 pad0/0/0/0 |
| `530:1423` 생년월일 (FRAME) | 530:1422 | 0,0 | 37,159 | 338×20 | H gap0 cross0 pad0/0/0/0 |
| `530:1426` 성별 (FRAME) | 530:1422 | 0,26 | 37,185 | 338×20 | H gap0 cross0 pad0/0/0/0 |
| `530:1429` 송금 계좌 (FRAME) | 530:1422 | 0,52 | 37,211 | 338×20 | H gap0 cross0 pad0/0/0/0 |
| `530:1432` 계정 완성하기 (FRAME) | 530:1413 | 20,202 | 20,262 | 372×289 | V gap10 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `530:1433` Head (FRAME) | 530:1432 | 17,17 | 37,279 | 338×23 | H gap0 cross0 pad0/0/0/0 |
| `530:1436` Progress (FRAME) | 530:1432 | 17,50 | 37,312 | 338×6 | H gap0 cross0 pad0/0/0/0; fill #e8e3dc (color/border) |
| `530:1437` Rectangle (RECTANGLE) | 530:1436 | 0,0 | 37,312 | 169×6 | fill #ff9900 (color/primary) |
| `530:1438` Task 음식 취향 매칭 (FRAME) | 530:1432 | 17,66 | 37,328 | 338×44 | H gap10 cross0 pad0/0/0/0 |
| `530:1439` Icon (FRAME) | 530:1438 | 0,11 | 37,339 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #e8f5ec (color/safe-bg) |
| `530:1440` icon/check (FRAME) | 530:1439 | 4,4 | 41,343 | 14×14 | clip |
| `530:1444` Task 일정 입력하기 (FRAME) | 530:1432 | 17,120 | 37,382 | 338×44 | H gap10 cross0 pad0/0/0/0 |
| `530:1445` Icon (FRAME) | 530:1444 | 0,11 | 37,393 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #e8f5ec (color/safe-bg) |
| `530:1446` icon/check (FRAME) | 530:1445 | 4,4 | 41,397 | 14×14 | clip |
| `530:1450` Task 송금 계좌 등록 (FRAME) | 530:1432 | 17,174 | 37,436 | 338×44 | H gap10 cross0 pad0/0/0/0 |
| `530:1453` 등록하기 (FRAME) | 530:1450 | 261,6 | 298,442 | 77×32 | H gap2 cross0 pad0/4/0/10; fill #fff3e0 (color/selected-bg) |
| `530:1451` Icon (FRAME) | 530:1450 | 0,11 | 37,447 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #f1eee9 (color/muted-bg) |
| `530:1455` icon/chev (FRAME) | 530:1453 | 57,8 | 355,450 | 16×16 | clip |
| `530:1457` Task 출발지 설정 (FRAME) | 530:1432 | 17,228 | 37,490 | 338×44 | H gap10 cross0 pad0/0/0/0 |
| `530:1460` 설정하기 (FRAME) | 530:1457 | 261,6 | 298,496 | 77×32 | H gap2 cross0 pad0/4/0/10; fill #fff3e0 (color/selected-bg) |
| `530:1458` Icon (FRAME) | 530:1457 | 0,11 | 37,501 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #f1eee9 (color/muted-bg) |
| `530:1462` icon/chev (FRAME) | 530:1460 | 57,8 | 355,504 | 16×16 | clip |
| `530:1464` Menu (FRAME) | 530:1413 | 20,505 | 20,565 | 372×338 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip |
| `530:1465` Row 내 친구 관리 (INSTANCE) | 530:1464 | 1,1 | 21,566 | 370×56 | H gap8 cross0 pad0/8/0/16; Show Value=true; Value=3명; Title=내 친구 관리; fill #ffffff (color/surface) |
| `I530:1465;518:1283` Chevron (FRAME) | 530:1465 | 334,6 | 355,572 | 28×44 | H gap0 cross0 pad0/0/0/0 |
| `I530:1465;518:1284` icon/chev (FRAME) | I530:1465;518:1283 | 4,12 | 359,584 | 20×20 | clip |
| `543:1550` Row 밥약 기록 (INSTANCE) | 530:1464 | 1,57 | 21,622 | 370×56 | H gap8 cross0 pad0/8/0/16; Show Value=true; Value=5개; Title=밥약 기록; fill #ffffff (color/surface) |
| `I543:1550;518:1283` Chevron (FRAME) | 543:1550 | 334,6 | 355,628 | 28×44 | H gap0 cross0 pad0/0/0/0 |
| `I543:1550;518:1284` icon/chev (FRAME) | I543:1550;518:1283 | 4,12 | 359,640 | 20×20 | clip |
| `530:1471` Row 출발지 설정 (INSTANCE) | 530:1464 | 1,113 | 21,678 | 370×56 | H gap8 cross0 pad0/8/0/16; Show Value=true; Value=아직 설정 안 됨; Title=출발지 설정; fill #ffffff (color/surface) |
| `I530:1471;518:1283` Chevron (FRAME) | 530:1471 | 334,6 | 355,684 | 28×44 | H gap0 cross0 pad0/0/0/0 |
| `I530:1471;518:1284` icon/chev (FRAME) | I530:1471;518:1283 | 4,12 | 359,696 | 20×20 | clip |
| `530:1477` Row 정보 공개 범위 (INSTANCE) | 530:1464 | 1,169 | 21,734 | 370×56 | H gap8 cross0 pad0/8/0/16; Show Value=false; Value=설정하기; Title=정보 공개 범위; fill #ffffff (color/surface) |
| `I530:1477;518:1283` Chevron (FRAME) | 530:1477 | 334,6 | 355,740 | 28×44 | H gap0 cross0 pad0/0/0/0 |
| `I530:1477;518:1284` icon/chev (FRAME) | I530:1477;518:1283 | 4,12 | 359,752 | 20×20 | clip |
| `530:1483` Row 음식 취향 다시 고르기 (INSTANCE) | 530:1464 | 1,225 | 21,790 | 370×56 | H gap8 cross0 pad0/8/0/16; Show Value=false; Value=설정하기; Title=음식 취향 다시 고르기; fill #ffffff (color/surface) |
| `I530:1483;518:1283` Chevron (FRAME) | 530:1483 | 334,6 | 355,796 | 28×44 | H gap0 cross0 pad0/0/0/0 |
| `I530:1483;518:1284` icon/chev (FRAME) | I530:1483;518:1283 | 4,12 | 359,808 | 20×20 | clip |
| `530:1497` BottomNav (INSTANCE) | 530:1403 | 0,820 | 0,820 | 412×72 | H gap0 cross0 pad6/8/14/8; Tab=프로필; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `I530:1497;518:1248` Tab 홈 (FRAME) | 530:1497 | 8,7 | 8,827 | 132×51 | V gap2 cross0 pad0/0/0/0 |
| `I530:1497;518:1253` Tab 일정 조율 (FRAME) | 530:1497 | 140,7 | 140,827 | 132×51 | V gap2 cross0 pad0/0/0/0 |
| `I530:1497;518:1258` Tab 프로필 (FRAME) | 530:1497 | 272,7 | 272,827 | 132×51 | V gap2 cross0 pad0/0/0/0 |
| `I530:1497;518:1249` icon/home (FRAME) | I530:1497;518:1248 | 54,4 | 62,831 | 24×24 | clip |
| `I530:1497;518:1254` icon/cal (FRAME) | I530:1497;518:1253 | 54,4 | 194,831 | 24×24 | clip |
| `I530:1497;518:1259` icon/user (FRAME) | I530:1497;518:1258 | 54,4 | 326,831 | 24×24 | clip |
| `564:1785` Row 설정 (INSTANCE) | 530:1464 | 1,281 | 21,846 | 370×56 | H gap8 cross0 pad0/8/0/16; Show Value=true; Value=알림 · 약관 · 계정; Title=설정; fill #ffffff (color/surface) |
| `I564:1785;518:1283` Chevron (FRAME) | 564:1785 | 334,6 | 355,852 | 28×44 | H gap0 cross0 pad0/0/0/0 |
| `I564:1785;518:1284` icon/chev (FRAME) | I564:1785;518:1283 | 4,12 | 359,864 | 20×20 | clip |
| `530:1489` Account Actions (FRAME) | 530:1413 | 20,857 | 20,917 | 372×60 | H gap0 cross0 pad0/0/0/0; 非表示 |
| `667:12770` Bottom Spacer (FRAME) | 530:1413 | 20,857 | 20,917 | 372×74 | clip |
| `530:1494` 계정 삭제 (FRAME) | 530:1489 | 312,0 | 332,917 | 60×61 | V gap0 cross0 pad12/4/12/4 |
| `530:1490` 로그아웃 (FRAME) | 530:1489 | 0,8 | 20,925 | 80×44 | H gap6 cross0 pad12/4/12/4 |
| `530:1491` icon/logout (FRAME) | 530:1490 | 4,13 | 24,938 | 18×18 | clip |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `530:1418` | 나야나 | 0,0 | 115,88 | 52×29 | T11 | 표시 (부모 clip 적용) |
| `530:1421` | 수정 | 15,12 | 336,103 | 24×20 | T12 | 표시 (부모 clip 적용) |
| `530:1419` | "오늘도 맛있는 하루" | 0,31 | 115,119 | 106×19 | T05 | 표시 (부모 clip 적용) |
| `530:1424` | 생년월일 | 0,0 | 37,159 | 48×20 | T03 | 표시 (부모 clip 적용) |
| `530:1425` | 2002년 12월 20일 | 230,0 | 267,159 | 108×20 | T13 | 표시 (부모 clip 적용) |
| `530:1427` | 성별 | 0,0 | 37,185 | 24×20 | T03 | 표시 (부모 clip 적용) |
| `530:1428` | 남성 | 314,0 | 351,185 | 24×20 | T13 | 표시 (부모 clip 적용) |
| `530:1430` | 송금 계좌 | 0,0 | 37,211 | 52×20 | T03 | 표시 (부모 clip 적용) |
| `530:1431` | 아직 등록 안 됨 | 255,0 | 292,211 | 83×20 | T14 | 표시 (부모 clip 적용) |
| `530:1434` | 계정 완성하기 | 0,0 | 37,279 | 311×23 | T04 | 표시 (부모 clip 적용) |
| `530:1435` | 2 / 4 | 311,2 | 348,281 | 27×19 | T01 | 표시 (부모 clip 적용) |
| `530:1442` | 음식 취향 매칭 | 32,11 | 69,339 | 273×22 | T15 | 표시 (부모 clip 적용) |
| `530:1443` | 완료 | 315,12.5 | 352,340.5 | 23×19 | T16 | 표시 (부모 clip 적용) |
| `530:1448` | 일정 입력하기 | 32,11 | 69,393 | 273×22 | T15 | 표시 (부모 clip 적용) |
| `530:1449` | 완료 | 315,12.5 | 352,394.5 | 23×19 | T16 | 표시 (부모 clip 적용) |
| `530:1452` | 송금 계좌 등록 | 32,11 | 69,447 | 219×22 | T17 | 표시 (부모 clip 적용) |
| `530:1454` | 등록하기 | 10,6.5 | 308,448.5 | 45×19 | T01 | 표시 (부모 clip 적용) |
| `530:1459` | 출발지 설정 | 32,11 | 69,501 | 219×22 | T17 | 표시 (부모 clip 적용) |
| `530:1461` | 설정하기 | 10,6.5 | 308,502.5 | 45×19 | T01 | 표시 (부모 clip 적용) |
| `I530:1465;518:1281` | 내 친구 관리 | 16,17 | 37,583 | 281×22 | T17 | 표시 (부모 clip 적용) |
| `I530:1465;518:1282` | 3명 | 305,18 | 326,584 | 21×20 | T03 | 표시 (부모 clip 적용) |
| `I543:1550;518:1281` | 밥약 기록 | 16,17 | 37,639 | 281×22 | T17 | 표시 (부모 clip 적용) |
| `I543:1550;518:1282` | 5개 | 305,18 | 326,640 | 21×20 | T03 | 표시 (부모 clip 적용) |
| `I530:1471;518:1281` | 출발지 설정 | 16,17 | 37,695 | 219×22 | T17 | 표시 (부모 clip 적용) |
| `I530:1471;518:1282` | 아직 설정 안 됨 | 243,18 | 264,696 | 83×20 | T03 | 표시 (부모 clip 적용) |
| `I530:1477;518:1281` | 정보 공개 범위 | 16,17 | 37,751 | 310×22 | T17 | 표시 (부모 clip 적용) |
| `I530:1483;518:1281` | 음식 취향 다시 고르기 | 16,17 | 37,807 | 310×22 | T17 | 표시 (부모 clip 적용) |
| `I530:1497;518:1252` | 홈 | 60.5,30 | 68.5,857 | 11×17 | T21 | 표시 (부모 clip 적용) |
| `I530:1497;518:1257` | 일정 조율 | 43.5,30 | 183.5,857 | 45×17 | T21 | 표시 (부모 clip 적용) |
| `I530:1497;518:1262` | 프로필 | 50.5,30 | 322.5,857 | 31×17 | T22 | 표시 (부모 clip 적용) |
| `I564:1785;518:1281` | 설정 | 16,17 | 37,863 | 202×22 | T17 | 표시 (부모 clip 적용) |
| `I564:1785;518:1282` | 알림 · 약관 · 계정 | 226,18 | 247,864 | 100×20 | T03 | 표시 (부모 clip 적용) |
| `530:1495` | 계정 삭제 | 4,12 | 336,929 | 52×20 | T19 | 표시 (부모 clip 적용) |
| `530:1493` | 로그아웃 | 28,12 | 48,937 | 48×20 | T18 | 표시 (부모 clip 적용) |
| `530:1496` | 준비 중 | 22,32 | 354,949 | 34×17 | T20 | 표시 (부모 clip 적용) |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `I530:1404;518:1290` Bell | NAVIGATE | [521:1429](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=521-1429) Phone 내 대상 |
| `530:1420` 프로필 수정 | NAVIGATE | [530:1513](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1513) Phone 내 대상 |
| `530:1450` Task 송금 계좌 등록 | NAVIGATE | [530:1513](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1513) Phone 내 대상 |
| `530:1457` Task 출발지 설정 | NAVIGATE | [530:1736](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1736) Phone 내 대상 |
| `530:1465` 내 친구 관리 | NAVIGATE | [530:1594](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1594) Phone 내 대상 |
| `543:1550` 밥약 기록 | NAVIGATE | [542:1534](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=542-1534) Phone 내 대상 |
| `530:1471` 출발지 설정 | NAVIGATE | [530:1736](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1736) Phone 내 대상 |
| `530:1477` 정보 공개 범위 | NAVIGATE | [530:1656](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=530-1656) Phone 내 대상 |
| `530:1483` 음식 취향 다시 고르기 | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |
| `564:1785` 설정 | NAVIGATE | [564:1791](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=564-1791) Phone 내 대상 |
| `I530:1497;518:1248` Tab 홈 | NAVIGATE | [521:1248](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=521-1248) Phone 내 대상 |
| `I530:1497;518:1253` Tab 일정 조율 | NAVIGATE | [524:1318](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=524-1318) Phone 내 대상 |

### 3.7 회원가입/구글 캘린더 연동

노드 [520:1244](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1244), 크기 412×892, 섹션 내 배치 (2660,120). 비벡터 하위 노드 및 루트 36개를 추출했다.

가입 STEP 2/4. ‘구글 캘린더 연결하기’와 ‘나중에 할게요’가 모두 음식 STEP 1로 연결된다. 그림/캘린더 예시는 이미지이며 이미지 안 글자는 아래 TEXT 노드 표의 대상이 아니다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `520:1244` 회원가입/구글 캘린더 연동 (FRAME) | 섹션 | 2660,120 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `520:1245` Header (FRAME) | 520:1244 | 0,0 | 0,0 | 412×174 | V gap12 cross0 pad16/20/20/20 |
| `520:1246` Top Bar (FRAME) | 520:1245 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0 |
| `520:1247` Back (FRAME) | 520:1246 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `520:1248` icon/back (FRAME) | 520:1247 | 10,10 | 30,26 | 24×24 | clip |
| `520:1251` Progress (FRAME) | 520:1245 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0 |
| `520:1252` Seg (RECTANGLE) | 520:1251 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `520:1253` Seg (RECTANGLE) | 520:1251 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `520:1254` Seg (RECTANGLE) | 520:1251 | 189,0 | 209,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `520:1255` Seg (RECTANGLE) | 520:1251 | 283.5,0 | 303.5,72 | 88.5×4 | fill #e8e3dc (color/border) |
| `520:1256` Title (FRAME) | 520:1245 | 20,88 | 20,88 | 372×66 | V gap6 cross0 pad8/0/0/0 |
| `520:1259` Body (FRAME) | 520:1244 | 0,174 | 0,174 | 412×391 | V gap16 cross0 pad0/20/0/20 |
| `520:1260` Illustration (FRAME) | 520:1259 | 20,0 | 20,174 | 372×222 | V gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #e8e3dc (color/border); clip |
| `520:1261` calmock (FRAME) | 520:1260 | 1,1 | 21,175 | 370×220 | fill IMAGE; clip; opacity 0.3499999940395355 |
| `520:1262` moa (FRAME) | 520:1260 | 126,60 | 146,234 | 120×98 | fill IMAGE, IMAGE; clip |
| `520:1263` What we use (FRAME) | 520:1259 | 20,238 | 20,412 | 372×153 | V gap14 cross0 pad16/16/16/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `520:1264` Point (FRAME) | 520:1263 | 17,17 | 37,429 | 338×43 | H gap12 cross0 pad0/0/0/0 |
| `520:1265` Icon (FRAME) | 520:1264 | 0,0 | 37,429 | 40×40 | H gap0 cross0 pad0/0/0/0; fill #fff3e0 (color/selected-bg) |
| `520:1269` Text (FRAME) | 520:1264 | 52,0 | 89,429 | 286×43 | V gap2 cross0 pad0/0/0/0 |
| `520:1266` icon/cal (FRAME) | 520:1265 | 10,10 | 47,439 | 20×20 | clip |
| `520:1272` Point (FRAME) | 520:1263 | 17,74 | 37,486 | 338×62 | H gap12 cross0 pad0/0/0/0 |
| `520:1273` Icon (FRAME) | 520:1272 | 0,0 | 37,486 | 40×40 | H gap0 cross0 pad0/0/0/0; fill #fff3e0 (color/selected-bg) |
| `520:1277` Text (FRAME) | 520:1272 | 52,0 | 89,486 | 286×62 | V gap2 cross0 pad0/0/0/0 |
| `520:1274` icon/lock (FRAME) | 520:1273 | 10,10 | 47,496 | 20×20 | clip |
| `520:1284` Footer (FRAME) | 520:1244 | 0,748 | 0,748 | 412×144 | V gap4 cross0 pad12/20/24/20; fill #f8f6f2 (color/bg) |
| `520:1280` CTA 연결 (INSTANCE) | 520:1284 | 20,12 | 20,760 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=구글 캘린더 연결하기; Kind=Primary; fill #ff9900 (color/primary) |
| `520:1282` CTA 나중에 (INSTANCE) | 520:1284 | 20,68 | 20,816 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=나중에 할게요; Kind=Text |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `520:1250` | STEP 2 / 4 | 311,12.5 | 331,28.5 | 61×19 | T01 | 표시 (부모 clip 적용) |
| `520:1257` | 구글 캘린더를 연결할까요? | 0,8 | 20,96 | 372×32 | T02 | 표시 (부모 clip 적용) |
| `520:1258` | 모아가 내 빈 시간을 모아서 약속 시간을 대신 맞춰 줘요. | 0,46 | 20,134 | 372×20 | T03 | 표시 (부모 clip 적용) |
| `520:1270` | 바쁜 시간만 읽어요 | 0,0 | 89,429 | 286×22 | T23 | 표시 (부모 clip 적용) |
| `520:1271` | 일정 제목과 내용은 메이트에게 보이지 않아요 | 0,24 | 89,453 | 286×19 | T05 | 표시 (부모 clip 적용) |
| `520:1278` | 언제든 끊을 수 있어요 | 0,0 | 89,486 | 286×22 | T23 | 표시 (부모 clip 적용) |
| `520:1279` | 일정 조율 탭의 '구글 자동 연동' 스위치로 언제든 끌 수 있어요 | 0,24 | 89,510 | 286×38 | T05 | 표시 (부모 clip 적용) |
| `I520:1280;493:1047` | 구글 캘린더 연결하기 | 120,15 | 140,775 | 132×22 | T09 | 표시 (부모 clip 적용) |
| `I520:1282;493:1051` | 나중에 할게요 | 142.5,15 | 162.5,831 | 87×22 | T24 | 표시 (부모 clip 적용) |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `520:1247` Back | NAVIGATE | [519:1262](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=519-1262) 회원가입/개인정보 입력 |
| `520:1280` 구글 캘린더 연결하기 | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |
| `520:1282` 나중에 할게요 | NAVIGATE | [495:1026](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1026) 가입/음식 프로필 STEP 1 |

### 3.8 회원가입/약관 동의

노드 [520:1285](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1285), 크기 412×892, 섹션 내 배치 (0,1683). 비벡터 하위 노드 및 루트 59개를 추출했다.

음식 STEP 2 이후의 가입 STEP 4/4. 전체·필수·건강·마케팅 Checkbox 모두 On인 대표 상태다. 이 화면에서 전체/필수 해제 상태별 가입 CTA 비활성 동작은 별도 검증되지 않았다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `520:1285` 회원가입/약관 동의 (FRAME) | 섹션 | 0,1683 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `520:1286` Header (FRAME) | 520:1285 | 0,0 | 0,0 | 412×174 | V gap12 cross0 pad16/20/20/20 |
| `520:1287` Top Bar (FRAME) | 520:1286 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0 |
| `520:1288` Back (FRAME) | 520:1287 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `520:1289` icon/back (FRAME) | 520:1288 | 10,10 | 30,26 | 24×24 | clip |
| `520:1292` Progress (FRAME) | 520:1286 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0 |
| `520:1293` Seg (RECTANGLE) | 520:1292 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `520:1294` Seg (RECTANGLE) | 520:1292 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `520:1295` Seg (RECTANGLE) | 520:1292 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `520:1296` Seg (RECTANGLE) | 520:1292 | 283.5,0 | 303.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `520:1297` Title (FRAME) | 520:1286 | 20,88 | 20,88 | 372×66 | V gap6 cross0 pad8/0/0/0 |
| `520:1300` Body (FRAME) | 520:1285 | 0,174 | 0,174 | 412×426 | V gap16 cross0 pad0/20/0/20 |
| `520:1301` Dudu (FRAME) | 520:1300 | 20,0 | 20,174 | 372×78 | H gap14 cross0 pad12/16/12/16; fill #fff3e0 (color/selected-bg) |
| `520:1302` dudu (FRAME) | 520:1301 | 16,12 | 36,186 | 72×54 | fill IMAGE, IMAGE; clip |
| `520:1304` Terms (FRAME) | 520:1300 | 20,94 | 20,268 | 372×259 | V gap0 cross0 pad8/8/8/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `520:1305` Check 전체 동의 (FRAME) | 520:1304 | 17,9 | 37,277 | 346×64 | H gap12 cross0 pad10/0/10/0 |
| `597:2304` Checkbox (INSTANCE) | 520:1305 | 0,10 | 37,287 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `I597:2304;597:2228` Box (FRAME) | 597:2304 | 11,11 | 48,298 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `I597:2304;597:2229` icon (FRAME) | I597:2304;597:2228 | 3,3 | 51,301 | 16×16 | clip |
| `520:1310` Divider (RECTANGLE) | 520:1304 | 17,73 | 37,341 | 346×1 | fill #e8e3dc (color/border) |
| `520:1311` Check [필수] 서비스 이용약관 (FRAME) | 520:1304 | 17,74 | 37,342 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `597:2308` Checkbox (INSTANCE) | 520:1311 | 0,0 | 37,342 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `520:1316` 보기 (FRAME) | 520:1311 | 302,0 | 339,342 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I597:2308;597:2228` Box (FRAME) | 597:2308 | 11,11 | 48,353 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `520:1317` icon/chev (FRAME) | 520:1316 | 12,12 | 351,354 | 20×20 | clip |
| `I597:2308;597:2229` icon (FRAME) | I597:2308;597:2228 | 3,3 | 51,356 | 16×16 | clip |
| `520:1319` Check [필수] 개인정보 처리방침 (FRAME) | 520:1304 | 17,118 | 37,386 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `597:2312` Checkbox (INSTANCE) | 520:1319 | 0,0 | 37,386 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `520:1324` 보기 (FRAME) | 520:1319 | 302,0 | 339,386 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I597:2312;597:2228` Box (FRAME) | 597:2312 | 11,11 | 48,397 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `520:1325` icon/chev (FRAME) | 520:1324 | 12,12 | 351,398 | 20×20 | clip |
| `I597:2312;597:2229` icon (FRAME) | I597:2312;597:2228 | 3,3 | 51,400 | 16×16 | clip |
| `552:1676` Check [선택] 건강 관련 정보 (FRAME) | 520:1304 | 17,162 | 37,430 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `604:2846` Checkbox (INSTANCE) | 552:1676 | 0,0 | 37,430 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `552:1681` 보기 (FRAME) | 552:1676 | 302,0 | 339,430 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I604:2846;597:2228` Box (FRAME) | 604:2846 | 11,11 | 48,441 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `552:1682` icon/chev (FRAME) | 552:1681 | 12,12 | 351,442 | 20×20 | clip |
| `I604:2846;597:2229` icon (FRAME) | I604:2846;597:2228 | 3,3 | 51,444 | 16×16 | clip |
| `520:1327` Check [선택] 마케팅 정보 수신 (FRAME) | 520:1304 | 17,206 | 37,474 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `597:2316` Checkbox (INSTANCE) | 520:1327 | 0,0 | 37,474 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `520:1332` 보기 (FRAME) | 520:1327 | 302,0 | 339,474 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I597:2316;597:2228` Box (FRAME) | 597:2316 | 11,11 | 48,485 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `520:1333` icon/chev (FRAME) | 520:1332 | 12,12 | 351,486 | 20×20 | clip |
| `I597:2316;597:2229` icon (FRAME) | I597:2316;597:2228 | 3,3 | 51,488 | 16×16 | clip |
| `520:1335` Hint (FRAME) | 520:1300 | 20,369 | 20,543 | 372×57 | H gap8 cross0 pad0/0/0/0 |
| `520:1336` icon/info (FRAME) | 520:1335 | 0,0 | 20,543 | 16×16 | clip |
| `520:1342` Footer (FRAME) | 520:1285 | 0,804 | 0,804 | 412×88 | V gap4 cross0 pad12/20/24/20; fill #f8f6f2 (color/bg) |
| `520:1340` CTA 가입 완료 (INSTANCE) | 520:1342 | 20,12 | 20,816 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=회원가입 끝내기; Kind=Primary; fill #ff9900 (color/primary) |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `520:1291` | STEP 4 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `520:1298` | 거의 다 왔어요! | 0,8 | 20,96 | 372×32 | T02 | 표시 (부모 clip 적용) |
| `520:1299` | 서비스를 쓰려면 아래 약관에 동의해 주세요. | 0,46 | 20,134 | 372×20 | T03 | 표시 (부모 clip 적용) |
| `520:1303` | 두두가 여러분의 의견을 모아서 두두두 전해 줄게요. | 102,19 | 122,193 | 254×40 | T25 | 표시 (부모 clip 적용) |
| `520:1309` | 전체 동의 | 56,20.5 | 93,297.5 | 290×23 | T04 | 표시 (부모 clip 적용) |
| `520:1315` | [필수] 서비스 이용약관 | 56,11 | 93,353 | 234×22 | T26 | 표시 (부모 clip 적용) |
| `520:1323` | [필수] 개인정보 처리방침 | 56,11 | 93,397 | 234×22 | T26 | 표시 (부모 clip 적용) |
| `552:1680` | [선택] 건강 관련 정보<br>(알레르기·식단 제한) 수집·이용 | 56,0 | 93,430 | 234×44 | T26 | 표시 (부모 clip 적용) |
| `520:1331` | [선택] 마케팅 정보 수신 | 56,11 | 93,485 | 234×22 | T26 | 표시 (부모 clip 적용) |
| `520:1339` | 필수 약관에 모두 동의해야 가입할 수 있어요. 건강 관련 정보는 동의한 날부터 1년만 보관하고, 1년마다 다시 여쭤봐요. 동의하지 않으면 저장하지 않아요. | 24,0 | 44,543 | 348×57 | T05 | 표시 (부모 clip 적용) |
| `I520:1340;493:1047` | 회원가입 끝내기 | 136,15 | 156,831 | 100×22 | T09 | 표시 (부모 clip 적용) |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `520:1288` Back | NAVIGATE | [495:1163](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=495-1163) 가입/음식 프로필 STEP 2 · 알레르기 |
| `597:2304` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `597:2308` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `520:1316` 보기 | NAVIGATE | [564:1961](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=564-1961) 프로필/서비스 이용약관 |
| `597:2312` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `520:1324` 보기 | NAVIGATE | [567:1909](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=567-1909) 프로필/개인정보 처리방침 |
| `552:1676` Check [선택] 건강 관련 정보 | NAVIGATE | [590:2447](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=590-2447) 회원가입/약관 동의 · 건강정보 미동의 |
| `604:2846` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `597:2316` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `520:1332` 보기 | NAVIGATE | [567:1909](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=567-1909) 프로필/개인정보 처리방침 |
| `520:1340` 회원가입 끝내기 | NAVIGATE | [563:2071](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=563-2071) 시작/알림 권한 안내 |

### 3.9 회원가입/약관 동의 · 건강정보 미동의

노드 [590:2447](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=590-2447), 크기 412×892, 섹션 내 배치 (532,1683). 비벡터 하위 노드 및 루트 58개를 추출했다.

건강 미동의 안내 문구 변형. 전체 동의 Checkbox 597:2334는 Off, 필수2개와 마케팅은 On이다. 건강 Checkbox 604:2850은 API/격리 렌더에서 On이므로 ‘건강만 해제’라는 주석·화면 이름과 충돌한다. 비동의 안내 문구 및 해당 줄의 반대 화면 이동만 확정할 수 있다.

#### 구성 요소: 위→아래

| 노드 / 이름 (종류) | 부모 | 부모 xy | 화면 xy | 크기 | 간격·패딩·상태·색 |
|---|---|---|---|---|---|
| `590:2447` 회원가입/약관 동의 · 건강정보 미동의 (FRAME) | 섹션 | 532,1683 | 0,0 | 412×892 | V gap0 cross0 pad0/0/0/0; fill #f8f6f2 (color/bg); clip |
| `590:2448` Header (FRAME) | 590:2447 | 0,0 | 0,0 | 412×174 | V gap12 cross0 pad16/20/20/20 |
| `590:2449` Top Bar (FRAME) | 590:2448 | 20,16 | 20,16 | 372×44 | H gap0 cross0 pad0/0/0/0 |
| `590:2450` Back (FRAME) | 590:2449 | 0,0 | 20,16 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `590:2451` icon/back (FRAME) | 590:2450 | 10,10 | 30,26 | 24×24 | clip |
| `590:2454` Progress (FRAME) | 590:2448 | 20,72 | 20,72 | 372×4 | H gap6 cross0 pad0/0/0/0 |
| `590:2455` Seg (RECTANGLE) | 590:2454 | 0,0 | 20,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2456` Seg (RECTANGLE) | 590:2454 | 94.5,0 | 114.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2457` Seg (RECTANGLE) | 590:2454 | 189,0 | 209,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2458` Seg (RECTANGLE) | 590:2454 | 283.5,0 | 303.5,72 | 88.5×4 | fill #ff9900 (color/primary) |
| `590:2459` Title (FRAME) | 590:2448 | 20,88 | 20,88 | 372×66 | V gap6 cross0 pad8/0/0/0 |
| `590:2462` Body (FRAME) | 590:2447 | 0,174 | 0,174 | 412×426 | V gap16 cross0 pad0/20/0/20 |
| `590:2463` Dudu (FRAME) | 590:2462 | 20,0 | 20,174 | 372×78 | H gap14 cross0 pad12/16/12/16; fill #fff3e0 (color/selected-bg) |
| `590:2464` dudu (FRAME) | 590:2463 | 16,12 | 36,186 | 72×54 | fill IMAGE, IMAGE; clip |
| `590:2466` Terms (FRAME) | 590:2462 | 20,94 | 20,268 | 372×259 | V gap0 cross0 pad8/8/8/16; fill #ffffff (color/surface); stroke #e8e3dc (color/border) |
| `590:2467` Check 전체 동의 (FRAME) | 590:2466 | 17,9 | 37,277 | 346×64 | H gap12 cross0 pad10/0/10/0 |
| `597:2334` Checkbox (INSTANCE) | 590:2467 | 0,10 | 37,287 | 44×44 | H gap0 cross0 pad0/0/0/0; State=Off |
| `I597:2334;597:2232` Box (FRAME) | 597:2334 | 11,11 | 48,298 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ffffff (color/surface); stroke #8c867e (직접값); clip |
| `590:2472` Divider (RECTANGLE) | 590:2466 | 17,73 | 37,341 | 346×1 | fill #e8e3dc (color/border) |
| `590:2473` Check [필수] 서비스 이용약관 (FRAME) | 590:2466 | 17,74 | 37,342 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `597:2336` Checkbox (INSTANCE) | 590:2473 | 0,0 | 37,342 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `590:2478` 보기 (FRAME) | 590:2473 | 302,0 | 339,342 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I597:2336;597:2228` Box (FRAME) | 597:2336 | 11,11 | 48,353 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `590:2479` icon/chev (FRAME) | 590:2478 | 12,12 | 351,354 | 20×20 | clip |
| `I597:2336;597:2229` icon (FRAME) | I597:2336;597:2228 | 3,3 | 51,356 | 16×16 | clip |
| `590:2481` Check [필수] 개인정보 처리방침 (FRAME) | 590:2466 | 17,118 | 37,386 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `597:2340` Checkbox (INSTANCE) | 590:2481 | 0,0 | 37,386 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `590:2486` 보기 (FRAME) | 590:2481 | 302,0 | 339,386 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I597:2340;597:2228` Box (FRAME) | 597:2340 | 11,11 | 48,397 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `590:2487` icon/chev (FRAME) | 590:2486 | 12,12 | 351,398 | 20×20 | clip |
| `I597:2340;597:2229` icon (FRAME) | I597:2340;597:2228 | 3,3 | 51,400 | 16×16 | clip |
| `590:2489` Check [선택] 건강 관련 정보 (FRAME) | 590:2466 | 17,162 | 37,430 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `604:2850` Checkbox (INSTANCE) | 590:2489 | 0,0 | 37,430 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `590:2494` 보기 (FRAME) | 590:2489 | 302,0 | 339,430 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I604:2850;597:2228` Box (FRAME) | 604:2850 | 11,11 | 48,441 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `590:2495` icon/chev (FRAME) | 590:2494 | 12,12 | 351,442 | 20×20 | clip |
| `I604:2850;597:2229` icon (FRAME) | I604:2850;597:2228 | 3,3 | 51,444 | 16×16 | clip |
| `590:2497` Check [선택] 마케팅 정보 수신 (FRAME) | 590:2466 | 17,206 | 37,474 | 346×44 | H gap12 cross0 pad0/0/0/0 |
| `597:2344` Checkbox (INSTANCE) | 590:2497 | 0,0 | 37,474 | 44×44 | H gap0 cross0 pad0/0/0/0; State=On |
| `590:2502` 보기 (FRAME) | 590:2497 | 302,0 | 339,474 | 44×44 | H gap0 cross0 pad0/0/0/0 |
| `I597:2344;597:2228` Box (FRAME) | 597:2344 | 11,11 | 48,485 | 22×22 | H gap0 cross0 pad0/0/0/0; fill #ff9900 (color/primary); clip |
| `590:2503` icon/chev (FRAME) | 590:2502 | 12,12 | 351,486 | 20×20 | clip |
| `I597:2344;597:2229` icon (FRAME) | I597:2344;597:2228 | 3,3 | 51,488 | 16×16 | clip |
| `590:2505` Hint (FRAME) | 590:2462 | 20,369 | 20,543 | 372×57 | H gap8 cross0 pad0/0/0/0 |
| `590:2506` icon/info (FRAME) | 590:2505 | 0,0 | 20,543 | 16×16 | clip |
| `590:2510` Footer (FRAME) | 590:2447 | 0,804 | 0,804 | 412×88 | V gap4 cross0 pad12/20/24/20; fill #f8f6f2 (color/bg) |
| `590:2511` CTA 가입 완료 (INSTANCE) | 590:2510 | 20,12 | 20,816 | 372×52 | H gap0 cross0 pad0/0/0/0; Label=회원가입 끝내기; Kind=Primary; fill #ff9900 (color/primary) |

#### 텍스트 원문 전부

| TEXT 노드 | 원문 | 부모 xy | 화면 xy | 크기 | 스타일 (크기·굵기·색은 §2.2) | 표시 |
|---|---|---|---|---|---|---|
| `590:2453` | STEP 4 / 4 | 310,12.5 | 330,28.5 | 62×19 | T01 | 표시 (부모 clip 적용) |
| `590:2460` | 거의 다 왔어요! | 0,8 | 20,96 | 372×32 | T02 | 표시 (부모 clip 적용) |
| `590:2461` | 서비스를 쓰려면 아래 약관에 동의해 주세요. | 0,46 | 20,134 | 372×20 | T03 | 표시 (부모 clip 적용) |
| `590:2465` | 두두가 여러분의 의견을 모아서 두두두 전해 줄게요. | 102,19 | 122,193 | 254×40 | T25 | 표시 (부모 clip 적용) |
| `590:2471` | 전체 동의 | 56,20.5 | 93,297.5 | 290×23 | T04 | 표시 (부모 clip 적용) |
| `590:2477` | [필수] 서비스 이용약관 | 56,11 | 93,353 | 234×22 | T26 | 표시 (부모 clip 적용) |
| `590:2485` | [필수] 개인정보 처리방침 | 56,11 | 93,397 | 234×22 | T26 | 표시 (부모 clip 적용) |
| `590:2493` | [선택] 건강 관련 정보<br>(알레르기·식단 제한) 수집·이용 | 56,0 | 93,430 | 234×44 | T26 | 표시 (부모 clip 적용) |
| `590:2501` | [선택] 마케팅 정보 수신 | 56,11 | 93,485 | 234×22 | T26 | 표시 (부모 clip 적용) |
| `590:2509` | 건강 관련 정보 없이 가입해요. 알레르기 · 식단 칸은 저장하지 않고, 추천에도 쓰지 않아요. 나중에 프로필 → 음식 취향에서 동의할 수 있어요. | 24,0 | 44,543 | 348×57 | T05 | 표시 (부모 clip 적용) |
| `I590:2511;493:1047` | 회원가입 끝내기 | 136,15 | 156,831 | 100×22 | T09 | 표시 (부모 clip 적용) |

#### 프로토타입 연결

모두 ON_CLICK. NAVIGATE는 화면 이동, CHANGE_TO는 마스터 variant 전환, BACK은 이전 프레임 복귀다. 실제 저장/네트워크 동작을 의미하지 않는다.

| 클릭 노드 / 라벨 | 동작 | 대상 노드 / 의미 |
|---|---|---|
| `590:2450` Back | BACK | 이전 프레임 |
| `597:2334` Checkbox | CHANGE_TO | [597:2227](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2227) Checkbox On |
| `597:2336` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `590:2478` 보기 | NAVIGATE | [564:1961](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=564-1961) 프로필/서비스 이용약관 |
| `597:2340` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `590:2486` 보기 | NAVIGATE | [567:1909](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=567-1909) 프로필/개인정보 처리방침 |
| `590:2489` Check [선택] 건강 관련 정보 | NAVIGATE | [520:1285](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=520-1285) 회원가입/약관 동의 |
| `604:2850` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `590:2494` 보기 | NAVIGATE | [567:1909](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=567-1909) 프로필/개인정보 처리방침 |
| `597:2344` Checkbox | CHANGE_TO | [597:2231](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=597-2231) Checkbox Off |
| `590:2502` 보기 | NAVIGATE | [567:1909](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=567-1909) 프로필/개인정보 처리방침 |
| `590:2511` 회원가입 끝내기 | NAVIGATE | [563:2071](https://www.figma.com/design/euLZpuvJsmuOhVKwtDkdhJ?node-id=563-2071) 시작/알림 권한 안내 |

## 4. 진입점·상태·연결 해석

| 출처 | 버튼/행 | 실제 연결 | 해석 |
|---|---|---|---|
| 가입 캘린더 `520:1244` | `520:1280` 구글 캘린더 연결하기, `520:1282` 나중에 할게요 | 둘 다 `495:1026` | 음식 STEP 1 진입. 실제 Google 권한 처리의 성공 조건은 프로토타입으로 확인 불가 |
| 프로필 홈 `530:1403` | `530:1438` 음식 취향 매칭 | 없음 | 완료 예시 행. 미완료의 설정 버튼 변형은 없음 |
| 프로필 홈 `530:1403` | `530:1483` 음식 취향 다시 고르기 | `495:1026` | 가입 화면 재사용. 편집 전용 머리말/저장 variant는 주석에만 있음 |
| 음식 STEP 1 두 상태 | CTA 다음 `495:1041`, `590:2367` | `495:1163` | STEP 2 알레르기 펼친 상태 |
| STEP 2 세 상태 | CTA 다음 `495:1178`, `495:1263`, `495:1340` | `520:1285` | 가입 약관으로 이어짐. 음식 화면 자체에는 저장/가입 완료 문구가 없음 |
| 약관 `520:1285` | Back `520:1288` | `495:1163` | 음식 STEP 2로 돌아감 |
| 약관 두 상태 | 회원가입 끝내기 `520:1340`, `590:2511` | `563:2071` 알림 권한 안내 | 주석 520:1465의 “홈”보다 실제 연결은 알림 안내가 한 단계 먼저임 |

Phone 전체에서 음식 화면 5개를 destination으로 가지는 prototype action을 역방향 검색했다. 외부 섹션에서 확인된 진입은 위 캘린더 버튼 두 개, 프로필 편집 메뉴 한 개, 약관 뒤로가기 한 개다. 별도 기존 사용자 안내/건강 동의 진입 화면은 찾지 못했다.

Chip/Radio의 대부분 연결은 `CHANGE_TO`로 공통 마스터의 Selected/On을 보여 준다. **단일 선택·배타 그룹의 모든 조합과 해제를 실제로 구현했다는 증거가 아니다.** 예를 들어 알레르기 없음 칩은 다른 Chip과 동일하게 Selected 마스터로 전환할 뿐, 다른 알레르기를 지우는 별도 프레임으로 이동하지 않는다. 상관없음만 별도의 대표 화면을 가진다. 기타 직접 입력도 현재는 Chip Selected로 바뀔 뿐 입력 화면으로 연결되지 않는다.

프로필 편집으로 STEP 1에 들어가도 현재 프로토타입은 가입 CTA/뒤로/STEP 표기를 그대로 공유한다. 주석의 “음식 취향 수정 / STEP 없음 / 저장”을 별도 모드로 구현할 범위는 남아 있다.

비선택→선택·선택→비선택 컴포넌트는 확인했지만 음식 입력의 loading/error/empty/disabled/저장 완료/미동의 차단 상태는 확인된 화면에 없다. Food STEP 1의 ‘상관없음’은 **음식 종류 8개 안에서만 배타**다. 주재료·형태·매운맛에 같은 라벨을 추가하는 것은 시안 추출이 아니라 새 설계다.

## 5. 선택지 코드표 초안

**아래 코드는 제안이며 Figma 저장 코드가 아니다.** 라벨은 실제 노드 문자열을 보존했고 모든 67개 범주별 선택지를 수록했다(같은 라벨이 여러 범주에 나오면 각각 기재). 범주와 코드를 함께 식별자로 사용한다. `none`/`any`의 서버 저장·null 정규화는 별도 계약에서 정해야 한다. `other_input`은 입력 UI를 여는 제어 코드 제안이며 자유 텍스트 수집·저장 승인을 뜻하지 않는다.

| 범주 (제안 group_code) | 라벨 원문 | 제안 코드 |
|---|---|---|
| 음식 종류 (`cuisine`) | 한식 | `korean` |
| 음식 종류 (`cuisine`) | 일식 | `japanese` |
| 음식 종류 (`cuisine`) | 중식 | `chinese` |
| 음식 종류 (`cuisine`) | 양식 | `western` |
| 음식 종류 (`cuisine`) | 동남아 | `southeast_asian` |
| 음식 종류 (`cuisine`) | 기타 세계음식 | `other_world` |
| 음식 종류 (`cuisine`) | 분식 | `snack_food` |
| 음식 종류 (`cuisine`) | 상관없음 | `any` |
| 주재료 · 육류 (`preferred_ingredient`) | 소고기 | `beef` |
| 주재료 · 육류 (`preferred_ingredient`) | 돼지고기 | `pork` |
| 주재료 · 육류 (`preferred_ingredient`) | 닭고기 | `chicken` |
| 주재료 · 육류 (`preferred_ingredient`) | 양고기 | `lamb` |
| 주재료 · 해산물 (`preferred_ingredient`) | 생선 | `fish` |
| 주재료 · 해산물 (`preferred_ingredient`) | 새우·게 등 갑각류 | `crustaceans` |
| 주재료 · 해산물 (`preferred_ingredient`) | 조개류 | `shellfish` |
| 주재료 · 해산물 (`preferred_ingredient`) | 오징어·문어 | `squid_octopus` |
| 주재료 · 기타 (`preferred_ingredient`) | 계란 | `egg` |
| 주재료 · 기타 (`preferred_ingredient`) | 두부·콩 | `tofu_soy` |
| 주재료 · 기타 (`preferred_ingredient`) | 채소 | `vegetables` |
| 주재료 · 기타 (`preferred_ingredient`) | 치즈·유제품 | `cheese_dairy` |
| 음식 형태 (`food_form`) | 밥 | `rice` |
| 음식 형태 (`food_form`) | 면 | `noodles` |
| 음식 형태 (`food_form`) | 국물·탕 | `soup` |
| 음식 형태 (`food_form`) | 찌개·전골 | `stew_hotpot` |
| 음식 형태 (`food_form`) | 구이 | `grilled` |
| 음식 형태 (`food_form`) | 튀김 | `fried` |
| 음식 형태 (`food_form`) | 볶음 | `stir_fried` |
| 음식 형태 (`food_form`) | 찜 | `steamed` |
| 음식 형태 (`food_form`) | 샐러드·가벼운 식사 | `salad_light_meal` |
| 매운맛 (`spice`) | 전혀 못 먹음 | `not_spicy` |
| 매운맛 (`spice`) | 조금 매운 정도 | `mild` |
| 매운맛 (`spice`) | 보통 | `medium` |
| 매운맛 (`spice`) | 매운 음식 좋아함 | `hot` |
| 매운맛 (`spice`) | 아주 매운 음식도 좋아함 | `very_hot` |
| 알레르기 (`allergy`) | 계란 | `egg` |
| 알레르기 (`allergy`) | 우유·유제품 | `milk_dairy` |
| 알레르기 (`allergy`) | 땅콩 | `peanut` |
| 알레르기 (`allergy`) | 견과류 | `tree_nuts` |
| 알레르기 (`allergy`) | 밀 | `wheat` |
| 알레르기 (`allergy`) | 메밀 | `buckwheat` |
| 알레르기 (`allergy`) | 대두·콩 | `soy` |
| 알레르기 (`allergy`) | 생선 | `fish` |
| 알레르기 (`allergy`) | 새우 | `shrimp` |
| 알레르기 (`allergy`) | 게 | `crab` |
| 알레르기 (`allergy`) | 조개류 | `shellfish` |
| 알레르기 (`allergy`) | 오징어 | `squid` |
| 알레르기 (`allergy`) | 소고기 | `beef` |
| 알레르기 (`allergy`) | 돼지고기 | `pork` |
| 알레르기 (`allergy`) | 닭고기 | `chicken` |
| 알레르기 (`allergy`) | 기타 직접 입력 | `other_input` |
| 알레르기 (`allergy`) | 알레르기 없음 | `none` |
| 못 먹는 음식 (`avoided_food`) | 회·날생선 | `raw_fish` |
| 못 먹는 음식 (`avoided_food`) | 내장 | `offal` |
| 못 먹는 음식 (`avoided_food`) | 곱창·막창 | `intestines` |
| 못 먹는 음식 (`avoided_food`) | 고수 | `cilantro` |
| 못 먹는 음식 (`avoided_food`) | 소고기 | `beef` |
| 못 먹는 음식 (`avoided_food`) | 해산물 | `seafood` |
| 못 먹는 음식 (`avoided_food`) | 유제품 | `dairy` |
| 못 먹는 음식 (`avoided_food`) | 육류 전체 | `all_meat` |
| 못 먹는 음식 (`avoided_food`) | 기타 직접 입력 | `other_input` |
| 못 먹는 음식 (`avoided_food`) | 없음 | `none` |
| 식단 유형 (`diet_type`) | 식단 제한 없음 | `none` |
| 식단 유형 (`diet_type`) | 채식 (고기 · 생선을 먹지 않음) | `vegetarian` |
| 식단 유형 (`diet_type`) | 비건 (동물성 음식을 먹지 않음) | `vegan` |
| 식단 유형 (`diet_type`) | 페스코 (생선 · 해산물은 먹음) | `pescatarian` |
| 추가로 피할 것 (`additional_avoid`) | 돼지고기 제외 | `exclude_pork` |
| 추가로 피할 것 (`additional_avoid`) | 기타 직접 입력 | `other_input` |

구분 주의: “내장”과 “곱창·막창”, “땅콩”과 “견과류”는 시안의 서로 다른 항목이다. 코드 합치기나 재료 분류·의학적 의미 확정은 하지 않았다. ‘우유·유제품’(알레르기), ‘유제품’(못 먹는 음식), ‘치즈·유제품’(선호)은 원문과 목적이 서로 다르다.

## 6. 주석 원문과 [결정] 목록

### 6.1 [결정] 접두가 있는 문구 전부

| 주석 프레임 | TEXT 노드 | 원문 |
|---|---|---|
| `499:1215` 주석 · 가입/음식 프로필 STEP 1 | `499:1244` | [결정] 배타 선택: ‘상관없음’을 고르면 나머지 해제, 다른 종류를 고르면 ‘상관없음’ 해제(알레르기 없음과 같은 규칙) |
| `499:1247` 주석 · STEP 2 · 알레르기 | `499:1268` | [결정] 안내 문구 유지 — 주재료 기준의 한계를 알리고 주문 전 확인을 권함 |
| `499:1247` 주석 · STEP 2 · 알레르기 | `499:1272` | [결정] 건강 관련 정보는 약관 화면에서 별도 선택 동의 · 동의한 날부터 1년 보관, 1년마다 다시 동의를 묻고 거절 · 철회 시 바로 파기 |
| `499:1275` 주석 · STEP 2 · 못 먹는 음식 | `499:1292` | [결정] 06 못 먹는 음식에서 돼지고기 · 매운 음식 제거(반영 완료) — 07 식단과 04 매운맛이 맡고, 05 알레르기의 돼지고기는 유지 |
| `499:1295` 주석 · STEP 2 · 식단 제한 | `499:1312` | [결정] 식단 유형(없음 · 채식 · 비건 · 페스코)은 하나만, 돼지고기 제외 · 기타 직접 입력은 추가로 여러 개 |
| `532:1523` 주석 · 프로필 홈 | `532:1548` | [결정] 02 화면을 그대로 쓰되 머리말은 "음식 취향 수정", STEP 표시 없이 버튼은 "저장" |
| `520:1418` 주석 · 구글 캘린더 연동 | `520:1435` | [결정] 시안은 실제 구글 연동(권한 요청) 기준 — 코드는 Figma 완료 후 반영 |
| `520:1418` 주석 · 구글 캘린더 연동 | `520:1439` | [결정] 해제는 일정 조율 탭의 "구글 자동 연동" 스위치(문구 반영 완료) |
| `520:1442` 주석 · 약관 동의 | `520:1463` | [결정] 02 화면을 'STEP 3 / 4' + '음식 프로필 1 / 2 · 2 / 2'로 통일함 |

### 6.2 “결정” 구획에 있으나 [결정] 접두가 없는 문구

| 주석 프레임 | TEXT 노드 | 원문 |
|---|---|---|
| `590:2427` 주석 · STEP 1 · 상관없음 선택 | `590:2444` | 프로토타입은 대표 상태 2개로 배타 규칙을 보여 줌 — 모든 칩 조합은 표현하지 않음 |
| `590:2513` 주석 · 약관 동의 · 건강정보 미동의 | `590:2530` | 선택 동의를 안 해도 가입 가능 — 02 음식 프로필의 알레르기 · 식단 입력은 저장하지 않음 |

### 6.3 읽은 주석 프레임별 텍스트 전체

주석의 오래된 개수·화면명·연결도 원문을 그대로 보존한다. 현재 노드와의 충돌은 §1 및 §7을 따른다.

#### 주석 · 가입/음식 프로필 STEP 1 — `499:1215`, 412×471

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `499:1216` | 변경점 · 가입/음식 프로필 STEP 1 | 15 / 700 |
| `499:1217` | 레거시 | 12 / 700 |
| `499:1218` | 1_회원가입/취향 분석(1:893) + 1.5_취향게임 6화면(1:941 등) — 고기·해산물·양식·중식·일식·한식을 하나씩 밀어서 답함 | 13 / 400 |
| `499:1219` | 바꾼 내용 | 12 / 700 |
| `499:1223` | 취향 게임 6문항 → 명세 01~04를 한 화면에서 고름 | 13 / 400 |
| `499:1227` | 01 음식 종류에 동남아·기타 세계음식·분식·상관없음 추가 / 02 주재료·03 형태·04 매운맛 신규 | 13 / 400 |
| `499:1231` | 04 매운맛은 하나만 고르는 44px 라디오 목록 | 13 / 400 |
| `499:1235` | 선택한 칩은 체크 + 진한 갈색 글씨(색만으로 구분하지 않음) | 13 / 400 |
| `499:1239` | 화면 폭 220 → 412px(최신 정산·온보딩 시안 기준) | 13 / 400 |
| `499:1240` | 결정 | 12 / 700 |
| `499:1244` | [결정] 배타 선택: ‘상관없음’을 고르면 나머지 해제, 다른 종류를 고르면 ‘상관없음’ 해제(알레르기 없음과 같은 규칙) | 13 / 400 |
| `499:1245` | 프로토타입 | 12 / 700 |
| `499:1246` | 다음 → STEP 2 · 알레르기 | 13 / 400 |

#### 주석 · STEP 2 · 알레르기 — `499:1247`, 412×441

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `499:1248` | 변경점 · STEP 2 · 알레르기 | 15 / 700 |
| `499:1249` | 레거시 | 12 / 700 |
| `499:1250` | 없음(신규) | 13 / 400 |
| `499:1251` | 바꾼 내용 | 12 / 700 |
| `499:1255` | 05 알레르기 17개 항목(명세 그대로), "알레르기 없음"은 배타 선택 | 13 / 400 |
| `499:1259` | 접힌 항목에도 고른 내용을 요약해서 보여 줌 | 13 / 400 |
| `499:1263` | 05·06·07은 펼치고 접는 아코디언 | 13 / 400 |
| `499:1264` | 결정 | 12 / 700 |
| `499:1268` | [결정] 안내 문구 유지 — 주재료 기준의 한계를 알리고 주문 전 확인을 권함 | 13 / 400 |
| `499:1272` | [결정] 건강 관련 정보는 약관 화면에서 별도 선택 동의 · 동의한 날부터 1년 보관, 1년마다 다시 동의를 묻고 거절 · 철회 시 바로 파기 | 13 / 400 |
| `499:1273` | 프로토타입 | 12 / 700 |
| `499:1274` | 06·07 헤더 → 해당 항목 펼침 / 뒤로 → STEP 1 / 가입 완료 → 레거시 홈(다른 페이지라 연결하지 않음) | 13 / 400 |

#### 주석 · STEP 2 · 못 먹는 음식 — `499:1275`, 412×361

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `499:1276` | 변경점 · STEP 2 · 못 먹는 음식 | 15 / 700 |
| `499:1277` | 레거시 | 12 / 700 |
| `499:1278` | 없음(신규) | 13 / 400 |
| `499:1279` | 바꾼 내용 | 12 / 700 |
| `499:1283` | 06 못 먹는 음식 12개 항목, "없음"은 배타 선택 | 13 / 400 |
| `499:1287` | 안내: 고른 항목은 추천에서 빼거나 우선순위를 크게 낮춤(명세 처리 원칙) | 13 / 400 |
| `499:1288` | 결정 | 12 / 700 |
| `499:1292` | [결정] 06 못 먹는 음식에서 돼지고기 · 매운 음식 제거(반영 완료) — 07 식단과 04 매운맛이 맡고, 05 알레르기의 돼지고기는 유지 | 13 / 400 |
| `499:1293` | 프로토타입 | 12 / 700 |
| `499:1294` | 05·07 헤더 → 해당 항목 펼침 / 뒤로 → STEP 1 | 13 / 400 |

#### 주석 · STEP 2 · 식단 제한 — `499:1295`, 412×341

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `499:1296` | 변경점 · STEP 2 · 식단 제한 | 15 / 700 |
| `499:1297` | 레거시 | 12 / 700 |
| `499:1298` | 없음(신규) | 13 / 400 |
| `499:1299` | 바꾼 내용 | 12 / 700 |
| `499:1303` | 07 식단 제한 6개 + 페스코 설명 | 13 / 400 |
| `499:1307` | "필요한 경우에만" 안내(명세: 필요한 사용자에 한해) | 13 / 400 |
| `499:1308` | 결정 | 12 / 700 |
| `499:1312` | [결정] 식단 유형(없음 · 채식 · 비건 · 페스코)은 하나만, 돼지고기 제외 · 기타 직접 입력은 추가로 여러 개 | 13 / 400 |
| `499:1313` | 프로토타입 | 12 / 700 |
| `499:1314` | 05·06 헤더 → 해당 항목 펼침 / 뒤로 → STEP 1 | 13 / 400 |

#### 주석 · STEP 1 · 상관없음 선택 — `590:2427`, 412×349

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `590:2428` | 변경점 · STEP 1 · 상관없음 선택 | 15 / 700 |
| `590:2429` | 레거시 | 12 / 700 |
| `590:2430` | 없음(신규) — 검토에서 "상관없음"을 눌러도 상태가 바뀌지 않던 문제 | 13 / 400 |
| `590:2431` | 바꾼 내용 | 12 / 700 |
| `590:2435` | "상관없음"을 고르면 한식 · 일식이 해제된 상태 | 13 / 400 |
| `590:2439` | 다른 종류를 누르면 "상관없음"이 풀리고 그 종류만 선택(STEP 1으로 돌아감) | 13 / 400 |
| `590:2440` | 결정 | 12 / 700 |
| `590:2444` | 프로토타입은 대표 상태 2개로 배타 규칙을 보여 줌 — 모든 칩 조합은 표현하지 않음 | 13 / 400 |
| `590:2445` | 프로토타입 | 12 / 700 |
| `590:2446` | 한식 → STEP 1 / 다음 → STEP 2 · 알레르기 | 13 / 400 |

#### 주석 · 프로필 홈 — `532:1523`, 412×445

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `532:1524` | 변경점 · 프로필 홈 | 15 / 700 |
| `532:1525` | 레거시 | 12 / 700 |
| `532:1526` | 프로필/프로필 홈(1:1776) — "🎉 계정 완성하기" 이모지 제목, "아직 설정 안됨" 빨간 작은 글씨, 로그아웃·계정 삭제가 목록과 붙어 있음 | 13 / 400 |
| `532:1527` | 바꾼 내용 | 12 / 700 |
| `532:1531` | 이모지 대신 진행 막대 + 2 / 4 숫자 | 13 / 400 |
| `532:1535` | 할 일마다 완료(초록 체크 + 글자) / 등록하기·설정하기(주황 알약 버튼) | 13 / 400 |
| `532:1539` | 설정 메뉴는 ListRow 컴포넌트 4줄 | 13 / 400 |
| `532:1543` | 로그아웃·계정 삭제를 맨 아래 따로, 계정 삭제는 "준비 중"으로 비활성 표시 | 13 / 400 |
| `532:1544` | 결정 | 12 / 700 |
| `532:1548` | [결정] 02 화면을 그대로 쓰되 머리말은 "음식 취향 수정", STEP 표시 없이 버튼은 "저장" | 13 / 400 |
| `532:1549` | 프로토타입 | 12 / 700 |
| `532:1550` | 수정 → 프로필 수정 / 내 친구 관리 · 출발지 설정 · 정보 공개 범위 → 각 화면 / 음식 취향 → 02 STEP 1 / 하단 탭 → 홈 · 일정 조율 | 13 / 400 |

#### 주석 · 구글 캘린더 연동 — `520:1418`, 412×397

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `520:1419` | 변경점 · 구글 캘린더 연동 | 15 / 700 |
| `520:1420` | 레거시 | 12 / 700 |
| `520:1421` | 회원가입/구글 캘린더 연동(1:818) — 달력 이미지 위 캐릭터, "필요시 추후 설정에서 변경 가능합니다!" 작은 글씨 | 13 / 400 |
| `520:1422` | 바꾼 내용 | 12 / 700 |
| `520:1426` | 무엇을 읽고 무엇을 안 보여 주는지 두 줄로 설명(권한 요청 전 신뢰) | 13 / 400 |
| `520:1430` | "나중에 할게요" 버튼을 명시(기존엔 작은 안내문만) | 13 / 400 |
| `520:1431` | 결정 | 12 / 700 |
| `520:1435` | [결정] 시안은 실제 구글 연동(권한 요청) 기준 — 코드는 Figma 완료 후 반영 | 13 / 400 |
| `520:1439` | [결정] 해제는 일정 조율 탭의 "구글 자동 연동" 스위치(문구 반영 완료) | 13 / 400 |
| `520:1440` | 프로토타입 | 12 / 700 |
| `520:1441` | 연결하기 / 나중에 → 02 가입 · 음식 프로필 STEP 1 / 뒤로 → 개인정보 입력 | 13 / 400 |

#### 주석 · 약관 동의 — `520:1442`, 412×340

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `520:1443` | 변경점 · 약관 동의 | 15 / 700 |
| `520:1444` | 레거시 | 12 / 700 |
| `520:1445` | 회원가입/약관 동의(1:906) — 체크박스 12px, "전체 동의"가 목록 맨 아래 | 13 / 400 |
| `520:1446` | 바꾼 내용 | 12 / 700 |
| `520:1450` | 전체 동의를 맨 위로, 구분선으로 분리 | 13 / 400 |
| `520:1454` | 각 줄 48px, 오른쪽 ">" 44px로 약관 원문 보기 | 13 / 400 |
| `520:1458` | 체크박스 22px, 선택 시 주황 바탕 + 어두운 체크 | 13 / 400 |
| `520:1459` | 결정 | 12 / 700 |
| `520:1463` | [결정] 02 화면을 'STEP 3 / 4' + '음식 프로필 1 / 2 · 2 / 2'로 통일함 | 13 / 400 |
| `520:1464` | 프로토타입 | 12 / 700 |
| `520:1465` | 회원가입 끝내기 → 홈 / 뒤로 → 02 STEP 2 | 13 / 400 |

#### 주석 · 약관 동의 · 건강정보 미동의 — `590:2513`, 412×349

| TEXT 노드 | 원문 | 크기 / 굵기 |
|---|---|---|
| `590:2514` | 변경점 · 약관 동의 · 건강정보 미동의 | 15 / 700 |
| `590:2515` | 레거시 | 12 / 700 |
| `590:2516` | 없음(신규) — 검토에서 선택 동의 체크가 바뀌지 않던 문제 | 13 / 400 |
| `590:2517` | 바꾼 내용 | 12 / 700 |
| `590:2521` | 건강 관련 정보만 해제 → 전체 동의도 해제 | 13 / 400 |
| `590:2525` | 해제했을 때 무엇이 달라지는지 바로 아래 안내 | 13 / 400 |
| `590:2526` | 결정 | 12 / 700 |
| `590:2530` | 선택 동의를 안 해도 가입 가능 — 02 음식 프로필의 알레르기 · 식단 입력은 저장하지 않음 | 13 / 400 |
| `590:2531` | 프로토타입 | 12 / 700 |
| `590:2532` | 건강 관련 정보 줄 → 약관 동의(체크됨) / 회원가입 끝내기 → 알림 권한 안내 | 13 / 400 |

## 7. docs/S5-food-profile-design.md와 다른 점

비교 대상은 이번에 로컬로 읽은 설계 문서다. 아래 줄 번호는 확인 시점 기준이다. 기존 문서는 수정하지 않았다. “제품 결정”으로 적힌 내용과 시안의 차이는 제품 결정이 틀렸다고 단정하는 대신 **시안과 계약을 맞춰야 하는 충돌**로 기록한다.

| 비교 지점 | 기존 S5 설계 | 현재 Figma 근거 / 차이 |
|---|---|---|
| §2 항목6, 줄61 / §3.3 줄116~128 | 알레르기 단일, allergy_code 단일 / allergies 0~1 | `495:1189` “여러 개 골라도 돼요”; Chip 목록17개. 단일 제품 결정과 현 시안이 충돌 |
| §3.3 건강 저장 필드 | 알레르기·식단 유형·추가로 피할 것 세 그룹 | 시안에는 **못 먹는 음식(06)** 복수10개가 독립 그룹으로 존재. 저장소/비민감·건강 분류 및 처리 의미를 별도로 정해야 함 |
| §3.2 줄100~105 | ingredients/forms에 any sentinel, spice의 마지막 예시 any | 주재료12·형태9에는 상관없음 없음. 매운맛 마지막은 “아주 매운 음식도 좋아함”이며 제한 없음이 아님. any를 마지막 단계 코드로 쓰면 의미가 달라짐 |
| §3.2 상한 | cuisines 1..16, ingredients 1..32, forms 1..16 방어 상한 제안 | 시안 목록은8/12/9이며 매운맛5. 최소·최대 선택 수는 화면에 없고 복수/단일 문구만 있음. 제안 상한을 Figma 확정값으로 바꾸지 않음 |
| §3.3 줄128 | 자유 입력 기타는 v1 제외 | 시안 알레르기 `495:1223`, 못 먹는 음식 `495:1308`, 추가 회피 `495:1377`에 “기타 직접 입력”이 있음. 입력 UI는 미제공이므로 포함/제외 결정과 시안 수정이 필요 |
| §4.1 줄145~150 | 약관·Auth/필수 동의 후 음식 STEP 1/2; 캘린더 일러스트 건너뛰기 | 현재 연결은 캘린더→음식1→음식2→약관. 본 문서는 외부 인증/동의 구현을 변경하지 않으며 이 순서를 서버 동의 계약으로 승인하지 않음 |
| §4.1 줄150, §2 항목3 | STEP 2 재진입 때 건강 선택 동의 재질문, 거절 가능 | 재동의 시트/거절/건너뛰기 노드 없음. 약관의 건강 선택 동의와 미동의 안내 변형만 존재 |
| §4.2 줄156 | 음식 취향 매칭→FoodProfileStep1, 완료 뒤 수정 CTA | 현재 Task는 완료 상태·연결 없음. 별도 메뉴 “음식 취향 다시 고르기”→STEP 1이 존재 |
| §4.2 / 주석 `532:1548` | 프로필 편집 경로 구현 제안 | Figma 주석은 머리말 “음식 취향 수정”, STEP 없음, “저장”을 요구. 실제 전용 노드/모드는 아직 없음 |
| §2 항목1, §4.2 줄158~159 | 기존 사용자 다음 실행 안내, 1회+나중에 7일은 제안 | 기존 사용자 안내 배너/시트/재노출 상태 노드 없음. 시안으로 횟수·기간·문구를 확정할 수 없음 |
| §4.4 줄173 | 초기 자동 선택으로 답변 생성하지 않음 | Figma에 선택된 예시 데이터가 있으나 최초 기본값을 선언하지 않음. 구현에서 자동 저장 기본값으로 가져오면 안 됨 |

### 7.1 Figma 내부에서 불일치하는 부분

| 근거 | 불일치 / 처리 |
|---|---|
| 주석 `499:1283` “12개” vs 실제 `495:1283` | 현재 못 먹는 음식은10개. 돼지고기·매운 음식 제거 결정 `499:1292`와 개수 설명이 동기화되지 않음 |
| 주석 `499:1307` “필요한 경우에만” 안내 | 현재 식단 펼침의 실제 안내는 `495:1367` “식단 유형은 하나만, 추가로 피할 것은 여러 개 고를 수 있어요”. 해당 문구 그대로의 안내 TEXT는 없음 |
| 주석 `499:1274` “가입 완료→레거시 홈(연결하지 않음)” | 실제 STEP 2 CTA는 “다음”이고 `520:1285` 약관으로 연결됨 |
| 주석 `520:1465` “회원가입 끝내기→홈” | 실제 버튼은 `563:2071` 알림 권한 안내로 연결됨 |
| 주석 `590:2439` “그 종류만 선택” | 한식 `590:2306` 클릭은 기본 `495:1026`으로 이동하며 한식·일식이 함께 Selected인 대표 상태 |
| 주석 `532:1548` 편집 모드 | 화면의 재사용 의도만 있고 실제 진입은 가입 STEP/다음/약관 이동을 그대로 가짐 |
| 건강 미동의 `590:2447`, 주석 `590:2521` | 건강 체크 해제 의도와 실제 Checkbox On이 불일치. 기본 렌더와 격리 렌더도 다르게 보여 실제 노드/격리 렌더 상태를 함께 기록 |

## 8. 검증·읽지 못한 노드·한계

- 화면9개의 크기·노드 트리·TEXT 문자열/폰트/굵기/색·선택 variant와 prototype action을 읽었다. 상세 추출한 비벡터 노드는 루트 포함 **737개**다. 동일 화면의 배치/본문/텍스트 표에 원본 ID를 보존했다.
- 핵심 음식5개와 진입·약관4개를 각각 렌더하여 육안 확인했다. 특히 건강 미동의 화면은 격리 렌더도 확인했다. 스크롤 아래 내용은 노드 좌표/문자열을 읽었고 실제 스크롤을 조작한 프로토타입 시연은 하지 않았다.
- 대상 화면/주석 프레임에서 **접근 실패로 읽지 못한 노드 없음**. STEP 2 동의 시트, 저장/오류/로딩/기타 입력창, 편집 전용·기존 사용자 안내 프레임은 Phone 내 검색에서 발견되지 않아 미제공으로 기록했다. 파일의 다른 페이지에까지 없다는 뜻은 아니다.
- 최초 다중 프레임/상세 조회 일부는 도구 반환 한도20,480 bytes를 초과했다. 쓰기 없는 조회였고 이후 화면/노드 배치로 나눠 재수집했다. 최종9개 화면은 배치별 수집 개수와 전체 개수를 대조했다.
- Figma의 픽셀 렌더와 구조 명세를 정리한 문서이며 실제 앱 구현·동의/건강정보 처리·서버 검증·기능 출시 완료의 증거가 아니다. `npm run quality`나 앱 테스트는 문서 추가 범위여서 실행하지 않았다.
- 파일 추가 전부터 저장소에는 S1 등 다수 변경/미추적 파일이 있었다. 이 문서 외 파일을 수정·스테이징·커밋하지 않았다.
- 문서 검증: 추출한 TEXT 원문 누락 0, Markdown 표 열 불일치 0, 코드표 67항목, [결정] 접두 문구 9개. 실제 파일의 UTF-8 대체문자 없음·줄 끝 공백 0을 확인했다. `git diff --check -- docs/S5-figma-spec.md`는 exit 0이며 미추적 파일이므로 별도로 본문 구조/공백도 검사했다. 작업 전후 Git status 차이는 이 신규 파일 1개뿐이었다.
