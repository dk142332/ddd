// ===== 설정 =====

// Vercel 서버리스 함수 경로 (인증키는 서버 측 환경변수에서 처리)
const API_URL = '/api/dust';

// 등급 숫자에 대응하는 한국어 라벨
const GRADE_LABEL = {
  '1': '좋음',
  '2': '보통',
  '3': '나쁨',
  '4': '매우나쁨',
};

// ===== DOM 요소 참조 =====

// 시도 선택 드롭다운
const sidoSelect = document.getElementById('sido-select');

// 평균 수치 표시 영역
const averageSection = document.getElementById('average-section');

// 평균 수치 텍스트
const averageValue = document.getElementById('average-value');

// 로딩 표시 영역
const loadingEl = document.getElementById('loading');

// 에러 메시지 영역
const errorEl = document.getElementById('error-message');

// 카드 목록 컨테이너
const cardGrid = document.getElementById('card-grid');

// ===== 이벤트 리스너 =====

// 시도가 바뀌면 데이터를 다시 불러온다
sidoSelect.addEventListener('change', () => {
  // 선택된 시도 이름 가져오기
  const sido = sidoSelect.value;

  // 빈 값이면 화면 초기화
  if (!sido) {
    resetUI();
    return;
  }

  // 선택된 시도의 데이터 불러오기
  fetchData(sido);
});

// ===== 데이터 요청 함수 =====

/**
 * 선택한 시도의 실시간 대기오염 데이터를 API에서 가져온다
 * @param {string} sido - 시도 이름 (예: "서울")
 */
async function fetchData(sido) {
  // UI 상태를 로딩 중으로 전환
  showLoading(true);
  hideError();
  cardGrid.innerHTML = '';
  averageSection.classList.add('hidden');

  try {
    // 서버리스 함수에 시도 이름만 전달 (인증키는 서버에서 처리)
    const response = await fetch(`${API_URL}?sido=${encodeURIComponent(sido)}`);

    // 응답 상태 확인
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    // JSON 파싱
    const data = await response.json();

    // 서버리스 함수에서 에러를 반환한 경우 처리
    if (data.error) {
      showError(data.message || '데이터를 불러오지 못했습니다.');
      return;
    }

    // 응답 데이터에서 측정 항목 배열 추출
    const items = data?.response?.body?.items ?? [];

    // 데이터가 없으면 안내
    if (items.length === 0) {
      showError('해당 지역의 측정 데이터가 없습니다.');
      return;
    }

    // 화면 렌더링
    renderAverage(items);
    renderCards(items);
  } catch (err) {
    // 에러 발생 시 사용자에게 안내
    console.error(err);
    showError(`데이터를 불러오지 못했습니다. ${err.message}`);
  } finally {
    // 로딩 표시 해제
    showLoading(false);
  }
}

// ===== 평균 수치 렌더링 =====

/**
 * 유효한 PM10 값들의 평균을 계산하여 상단에 표시한다
 * @param {Array} items - 측정 항목 배열
 */
function renderAverage(items) {
  // 유효한 PM10 숫자만 필터링 ("-" 또는 비어 있는 값 제외)
  const validValues = items
    .map((item) => item.pm10Value)
    .filter((v) => v !== null && v !== undefined && v !== '-' && v !== '')
    .map(Number)
    .filter((n) => !isNaN(n));

  // 유효 값이 없으면 표시 불가
  if (validValues.length === 0) {
    averageValue.textContent = '—';
  } else {
    // 평균 계산 후 소수 첫째 자리까지 표시
    const avg = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    averageValue.textContent = avg.toFixed(1);
  }

  // 평균 영역 보이기
  averageSection.classList.remove('hidden');
}

// ===== 카드 목록 렌더링 =====

/**
 * 측정소별 카드를 생성하여 그리드에 추가한다
 * @param {Array} items - 측정 항목 배열
 */
function renderCards(items) {
  // 기존 카드 비우기
  cardGrid.innerHTML = '';

  // 각 측정소 항목에 대해 카드 생성
  items.forEach((item) => {
    // 카드 요소 만들기
    const card = document.createElement('div');
    card.className = `card ${getGradeClass(item.pm10Grade)}`;

    // 측정소 이름
    const stationName = item.stationName || '알 수 없음';

    // PM10 표시 값 (없으면 "측정 안 됨")
    const pm10Display = formatValue(item.pm10Value);

    // PM2.5 표시 값 (없으면 "측정 안 됨")
    const pm25Display = formatValue(item.pm25Value);

    // 등급 배지 텍스트와 클래스
    const gradeText = getGradeText(item.pm10Grade);
    const badgeClass = getBadgeClass(item.pm10Grade);

    // 측정 시각
    const dataTime = item.dataTime || '정보 없음';

    // 카드 내부 HTML 구성
    card.innerHTML = `
      <div class="card__station">
        ${stationName}
        <span class="card__badge ${badgeClass}">${gradeText}</span>
      </div>
      <div class="card__row">
        <span class="card__row-label">미세먼지 (PM10)</span>
        <span class="card__row-value">${pm10Display}</span>
      </div>
      <div class="card__row">
        <span class="card__row-label">초미세먼지 (PM2.5)</span>
        <span class="card__row-value">${pm25Display}</span>
      </div>
      <div class="card__time">🕐 ${dataTime}</div>
    `;

    // 카드를 그리드에 추가
    cardGrid.appendChild(card);
  });
}

// ===== 유틸리티 함수 =====

/**
 * 측정값을 표시용 문자열로 변환한다
 * "-" 이거나 비어 있으면 "측정 안 됨"을 반환한다
 * @param {string|number} value - 원본 측정값
 * @returns {string} 표시용 문자열
 */
function formatValue(value) {
  // 값이 없거나 "-"이면 측정 안 됨 처리
  if (value === null || value === undefined || value === '-' || value === '') {
    return '측정 안 됨';
  }
  // 숫자 뒤에 단위 붙이기
  return `${value} ㎍/㎥`;
}

/**
 * 등급 숫자에 맞는 카드 CSS 클래스를 반환한다
 * 등급이 비어 있으면 회색(card--grade-none)을 반환한다
 * @param {string|number} grade - 등급 숫자
 * @returns {string} CSS 클래스 이름
 */
function getGradeClass(grade) {
  // 등급이 없으면 회색 처리
  if (!grade || grade === '' || grade === null) {
    return 'card--grade-none';
  }
  // 유효한 등급이면 해당 클래스 반환
  const g = String(grade);
  if (['1', '2', '3', '4'].includes(g)) {
    return `card--grade-${g}`;
  }
  // 예상 밖의 값도 회색 처리
  return 'card--grade-none';
}

/**
 * 등급 숫자를 한국어 텍스트로 변환한다
 * @param {string|number} grade - 등급 숫자
 * @returns {string} 등급 한국어 텍스트
 */
function getGradeText(grade) {
  // 등급이 없으면 "등급 없음" 반환
  if (!grade || grade === '' || grade === null) {
    return '등급 없음';
  }
  // 라벨 매핑에서 찾기
  return GRADE_LABEL[String(grade)] || '등급 없음';
}

/**
 * 등급 숫자에 맞는 배지 CSS 클래스를 반환한다
 * @param {string|number} grade - 등급 숫자
 * @returns {string} 배지 CSS 클래스 이름
 */
function getBadgeClass(grade) {
  // 등급이 없으면 회색 배지
  if (!grade || grade === '' || grade === null) {
    return 'badge--none';
  }
  const g = String(grade);
  // 유효한 등급이면 해당 배지 클래스
  if (['1', '2', '3', '4'].includes(g)) {
    return `badge--${g}`;
  }
  // 그 외는 회색 배지
  return 'badge--none';
}

// ===== UI 상태 제어 함수 =====

/**
 * 로딩 표시를 보이거나 숨긴다
 * @param {boolean} show - true면 보이고, false면 숨긴다
 */
function showLoading(show) {
  // hidden 클래스 토글
  loadingEl.classList.toggle('hidden', !show);
}

/**
 * 에러 메시지를 화면에 표시한다
 * @param {string} msg - 에러 메시지 텍스트
 */
function showError(msg) {
  // 에러 텍스트 설정 후 보이기
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

/**
 * 에러 메시지를 숨긴다
 */
function hideError() {
  // 에러 영역 숨기기
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

/**
 * 화면을 초기 상태로 되돌린다
 */
function resetUI() {
  // 모든 동적 영역 초기화
  cardGrid.innerHTML = '';
  averageSection.classList.add('hidden');
  hideError();
  showLoading(false);
}

