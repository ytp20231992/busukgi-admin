# 관리자 대시보드 사용 가이드

## 📋 개요

SanGa Pro 관리자 대시보드는 사용자 관리, 구독 관리, 앱 설정을 위한 웹 기반 GUI입니다.

---

## 🚀 배포 방법

### 1. 설정 파일 수정

`backend/admin/admin.js` 파일을 열어 다음 값을 수정하세요:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const ADMIN_KAKAO_ID = 'YOUR_ADMIN_KAKAO_ID';
```

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase anon 키
- `ADMIN_KAKAO_ID`: Edge Functions 환경변수와 동일한 관리자 카카오 ID

### 2. 호스팅 옵션

#### 옵션 A: GitHub Pages (무료)

1. GitHub 리포지토리 생성
2. `backend/admin/` 폴더 내용을 푸시
3. Settings → Pages에서 배포
4. `https://username.github.io/repo-name/` 형태로 접근

#### 옵션 B: Netlify (무료)

1. Netlify 가입 (https://netlify.com)
2. "New site from Git" 클릭
3. `backend/admin/` 폴더 배포
4. 자동 HTTPS 제공

#### 옵션 C: 로컬 실행

```bash
cd backend/admin
python -m http.server 8080
# 또는
npx serve
```

브라우저에서 `http://localhost:8080` 접속

---

## 🎯 주요 기능

### 1️⃣ 대시보드 통계

메인 화면 상단에 4개의 통계 카드 표시:

- **전체 사용자**: 등록된 계정 수
- **활성 구독**: 현재 유료 사용자 수
- **만료 예정**: 7일 이내 만료되는 구독 수
- **차단된 계정**: 접근 제한 중인 사용자 수

### 2️⃣ 사용자 관리 탭

#### 기능:
- 사용자 검색 (아이디, 닉네임, 이메일)
- 사용자 상세 정보 조회
- 구독 추가/수정
- 관리자 메모 작성
- 사용자 차단/해제

#### 테이블 컬럼:
- 사용자 정보 (닉네임/아이디, 이메일, 메모)
- 인증 방식 (카카오 / ID/PW)
- 구독 플랜 (FREE / PRO / DEMO)
- 구독 상태 (활성 / 만료 / 차단됨)
- 가입일
- 관리 버튼 (상세, 구독, 메모, 차단)

#### 페이지네이션:
- 한 페이지당 20명씩 표시
- 이전/다음 페이지 버튼

### 3️⃣ 구독 관리 탭

현재 활성화된 구독 목록 표시:

- 사용자 정보
- 플랜 종류
- 시작일/종료일
- 남은 기간
- 상태

### 4️⃣ 앱 설정 탭

앱 전역 설정 관리:

- **최신 버전**: 현재 최신 버전 번호 (예: 2.0.2)
- **최소 지원 버전**: 지원하는 최소 버전 (예: 2.0.0)
- **공지사항**: 사용자에게 표시될 메시지

---

## 🔐 보안 주의사항

### 1. 관리자 인증

현재 구현은 **카카오 ID 기반 검증**을 사용합니다:

```javascript
const ADMIN_KAKAO_ID = 'YOUR_ADMIN_KAKAO_ID';
```

⚠️ **중요**:
- 이 값은 Edge Functions의 환경변수 `ADMIN_KAKAO_ID`와 일치해야 합니다
- 프론트엔드에 노출되므로, 추가 보안 레이어가 필요할 수 있습니다

### 2. 접근 제한 권장사항

프로덕션 환경에서는 다음 중 하나를 적용하세요:

#### 방법 A: IP 화이트리스트 (Netlify)
```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  conditions = {IP = ["your.ip.address"]}
```

#### 방법 B: 베이직 인증 추가
```html
<!-- index.html에 추가 -->
<script>
  const ADMIN_PASSWORD = 'your-secure-password';
  const entered = prompt('관리자 비밀번호를 입력하세요:');
  if (entered !== ADMIN_PASSWORD) {
    alert('접근 거부');
    window.location.href = 'about:blank';
  }
</script>
```

#### 방법 C: OAuth 로그인 추가
- Kakao OAuth 로그인 구현
- 로그인 후 카카오 ID 검증
- 세션 기반 접근 제어

---

## 📱 사용 시나리오

### 시나리오 1: 신규 사용자에게 구독 추가

1. **사용자 관리** 탭으로 이동
2. 검색 바에서 사용자 검색 (아이디/이메일)
3. 해당 사용자의 **➕ 구독** 버튼 클릭
4. 모달에서 플랜(Free/Pro)과 기간(일) 선택
5. **추가** 버튼 클릭
6. 성공 메시지 확인

### 시나리오 2: 악의적 사용자 차단

1. **사용자 관리** 탭에서 대상 사용자 찾기
2. **🚫 차단** 버튼 클릭
3. 차단 사유 입력 (예: "결제 거부", "약관 위반")
4. **차단** 버튼 클릭
5. 사용자 상태가 "차단됨"으로 변경됨
6. 해당 사용자는 즉시 모든 기능 사용 불가

### 시나리오 3: 관리자 메모 작성

1. 사용자의 **📝 메모** 버튼 클릭
2. 메모 내용 입력 (예: "VIP 고객", "환불 요청", "버그 리포트")
3. **저장** 클릭
4. 테이블에서 메모가 표시됨

### 시나리오 4: 앱 버전 업데이트 공지

1. **앱 설정** 탭으로 이동
2. **최신 버전**에 새 버전 입력 (예: 2.1.0)
3. **공지사항**에 업데이트 내용 입력:
   ```
   🎉 v2.1.0 업데이트
   - 새로운 수익률 계산 기능 추가
   - 성능 개선
   ```
4. **💾 저장** 클릭
5. 모든 사용자가 다음 실행 시 공지 확인

---

## 🎨 UI/UX 특징

### 반응형 디자인
- 데스크톱, 태블릿, 모바일 모두 지원
- 그리드 레이아웃 자동 조정

### 색상 코드
- **Primary**: `#667eea` (보라색) - 메인 액션
- **Success**: `#4CAF50` (녹색) - 긍정적 액션
- **Danger**: `#ff6b6b` (빨간색) - 위험한 액션
- **Warning**: `#feca57` (노란색) - 주의 필요

### 뱃지 시스템
- 플랜: FREE (회색), PRO (보라), DEMO (노랑)
- 상태: 활성 (녹색), 만료 (빨강), 차단 (검정)
- 인증: 카카오 (노랑), ID/PW (파랑)

---

## 🛠️ API 연동

대시보드는 `admin-manage` Edge Function을 호출합니다:

```javascript
// 사용자 목록 조회
await callAdminAPI('list_users', { search: '검색어' });

// 구독 추가
await callAdminAPI('add_subscription', {
  user_id: 'uuid',
  plan: 'pro',
  days: 30
});

// 사용자 차단
await callAdminAPI('block_user', {
  user_id: 'uuid',
  reason: '차단 사유'
});

// 메모 업데이트
await callAdminAPI('update_memo', {
  user_id: 'uuid',
  memo: '메모 내용'
});

// 통계 조회
await callAdminAPI('get_stats');

// 앱 설정 업데이트
await callAdminAPI('update_app_config', {
  latest_version: '2.0.2',
  min_version: '2.0.0',
  announcement: '공지사항'
});
```

---

## 🐛 문제 해결

### 문제 1: "API 호출 실패" 에러

**원인**: CORS 또는 잘못된 API 키

**해결**:
1. `admin.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 확인
2. Supabase Dashboard에서 CORS 설정 확인
3. 브라우저 콘솔에서 네트워크 탭 확인

### 문제 2: "권한 없음" 에러

**원인**: 관리자 카카오 ID 불일치

**해결**:
1. `admin.js`의 `ADMIN_KAKAO_ID` 확인
2. Edge Functions 환경변수 `ADMIN_KAKAO_ID` 확인
3. 두 값이 정확히 일치하는지 확인

### 문제 3: 데이터가 로드되지 않음

**원인**: Edge Functions 미배포 또는 오류

**해결**:
1. Supabase Dashboard → Edge Functions 확인
2. `admin-manage` 함수가 배포되었는지 확인
3. 함수 로그 확인

---

## 📊 모니터링

### 로그 확인

브라우저 개발자 도구 (F12) → Console 탭:
- API 호출 성공/실패 로그
- 에러 메시지
- 네트워크 요청

### 성능

- 초기 로딩: ~1초
- 사용자 검색: ~500ms
- 테이블 렌더링: 20명/페이지
- API 응답 시간: ~200-500ms

---

## 🔮 향후 개선 사항

1. **OAuth 로그인**: 카카오 로그인 기반 관리자 인증
2. **실시간 알림**: 신규 가입, 구독 만료 알림
3. **통계 차트**: Chart.js를 이용한 시각화
4. **엑셀 내보내기**: 사용자/구독 데이터 다운로드
5. **활동 로그**: 관리자 작업 이력 추적
6. **대량 작업**: 여러 사용자 동시 처리

---

## 📞 지원

문제가 발생하면:
1. 브라우저 콘솔 로그 확인
2. Supabase Edge Functions 로그 확인
3. GitHub Issues에 보고

---

**제작**: SanGa Pro Admin Dashboard v1.0
**최종 업데이트**: 2025년 1월
#   s a n g a - a d m i n  
 