📊 MRD: All-Access Home (Market Requirements Document)
Project Code: AAH-2025-MVP
Date: 2025. 12. 15
Version: 1.0
Author: Product Planning Team
1. 개요 (Executive Summary)
**"All-Access Home"**은 고가의 전용 하드웨어 없이, 사용자가 이미 보유한 스마트 디바이스(노트북/태블릿)의 웹캠과 센서를 활용하여 물리적 공간을 제어할 수 있는 Web-based Assistive Tech(AT) 플랫폼이다.
최근 Apple Vision Pro 등으로 공간 컴퓨팅에 대한 관심은 높아졌으나, 정작 이를 필요로 하는 중증 장애인은 무게와 비용 문제로 소외되고 있다. 본 제품은 Web Lite-SLAM과 멀티모달 입력 기술을 통해, 기존 스마트홈 시장의 '접근성 격차(Accessibility Gap)'를 해소하고 '저비용 고효율'의 보조공학 솔루션을 제공하는 것을 목표로 한다.
2. 시장 분석 (Market Analysis)
2.1. 시장 규모 및 기회 (Market Size)
TAM (Total Addressable Market): 글로벌 보조공학(Assistive Tech) 시장. 2030년까지 약 260억 달러(약 34조 원) 규모, 연평균 성장률(CAGR) 7.4%.
SAM (Serviceable Available Market): 스마트홈 접근성 솔루션 및 대체 의사소통(AAC) 기기 시장.
SOM (Serviceable Obtainable Market): 국내외 상지 기능 장애인(척수 손상, 루게릭 등) 중 스마트 기기 보유자 및 디지털 헬스케어 수용층.
2.2. 시장의 문제점 (Problem Statement)
비용 장벽: 안구 마우스(Eye Tracker) 전용 기기는 평균 500~1,000만 원대로, 정부 보조 없이는 구매가 불가능함.
플랫폼 파편화: 스마트 전구, TV, 에어컨의 제어 앱이 모두 달라, 신체 거동이 불편한 사용자가 여러 앱을 오가는 것이 불가능에 가까움.
직관성 부재: 기존 앱은 텍스트 리스트 방식(예: '거실 전등 1')이라, 인지 능력이 저하된 고령자나 직관적인 제어를 원하는 사용자에게 높은 인지 부하(Cognitive Load)를 줌.
2.3. 경쟁사 분석 (Competitive Landscape)
구분	Tobii Dynavox (High-End)	Google Home / Alexa (General)	All-Access Home (Target)
핵심 기술	고정밀 적외선 하드웨어	음성 인식 (Voice AI)	Web Vision AI + SLAM
비용	$5,000+ (매우 비쌈)	$50 (저렴)	$0 (기존 기기 활용)
장점	압도적인 정확도	높은 호환성	설치 불필요, 시각적 직관성
약점	가격, 휴대성, 폐쇄성	발음 부정확 시 사용 불가	조명 환경에 따른 인식률 편차
3. 타겟 페르소나 (Target Persona)
Primary User: "자립을 꿈꾸는 민수 씨"
프로필: 34세, 경추 손상(C4) 사지마비, 휠체어 사용.
상황: 하루 대부분을 침대나 휠체어에서 보냄. 목 위로는 움직일 수 있음.
Pain Point: "TV 채널 하나 돌리려고 활동보조사를 부르는 게 너무 미안하고 자존심 상한다."
Needs: 내 눈이나 턱짓만으로 방 안의 기기를 끄고 켜고 싶음.
Secondary User: "디지털이 낯선 보호자 지은 님"
프로필: 60세, 민수 씨의 어머니.
상황: 기계 작동에 서툶. 복잡한 설정은 질색임.
Needs: "아들이 쓸 수 있게 세팅해 주고 싶은데, 선 연결하고 프로그램 깔고... 너무 복잡하면 못 해요."
4. 핵심 요구사항 (Key Requirements)
시장 요구사항을 충족하기 위한 기능적/비기능적 요구사항의 우선순위를 정의함.
4.1. 기능적 요구사항 (Functional Requirements)
우선순위	영역	요구사항 상세 (Description)	근거 (Rationale)
P0 (Must)	Web Access	별도 앱 설치 없이 브라우저(Chrome/Safari) URL 접속만으로 구동되어야 함.	접근성 장벽 제거 및 배포 용이성.
P0 (Must)	Lite-SLAM	디바이스를 360도 회전했을 때, AR 마커가 실제 사물 위치에 오차 10cm 내로 고정되어야 함.	"저것을 켠다"는 직관적 경험의 핵심.
P0 (Must)	Eye-Dwell	눈으로 2초 응시 시 클릭이 되는 '드웰 클릭' 기능과 시각적 피드백(게이지) 필수.	손을 못 쓰는 사용자의 유일한 입력 수단.
P1 (Should)	Multimodal	시선 외에 블루투스 마우스, 키보드(Switch), 터치 입력을 옵션에서 선택 가능해야 함.	장애 진행 단계(컨디션)에 따른 유연한 대응.
P1 (Should)	Setup Wizard	보호자가 3단계(카메라 허용 -> 공간 스캔 -> 버튼 배치) 내에 설정을 완료해야 함.	Secondary Persona(보호자)의 낮은 Tech Literacy 고려.
P2 (Nice)	IoT Connect	클릭 시 실제 HTTP Request를 날려 스마트홈 API(Tuya, Hue 등)와 연동되어야 함.	MVP 이후 실제 효용성 증대를 위해 필요.
4.2. 비기능적 요구사항 (Non-Functional Requirements)
성능 (Latency): 시선 이동에 따른 커서 반응 속도는 100ms 이내, 클릭 처리 속도는 200ms 이내여야 함.
호환성 (Compatibility): 저사양 태블릿(Galaxy Tab A 시리즈, iPad 9세대)에서도 20FPS 이상 유지.
프라이버시 (Privacy): 카메라 영상 데이터는 절대 서버로 전송되지 않고 브라우저 메모리 내에서만 처리(On-device) 후 소멸되어야 함.
안정성 (Stability): 30분 이상 연속 사용 시 브라우저 크래시(메모리 누수)가 없어야 함.
5. 시장 진입 전략 (Go-to-Market Strategy)
5.1. 배포 및 채널 전략
Web-First: PWA(Progressive Web App) 형태로 배포하여 접근성을 극대화. 검색 엔진 최적화(SEO)를 통해 "안구 마우스", "장애인 스마트홈" 키워드 유입 유도.
Open Source & Community: GitHub에 MVP를 공개하고, 개발자 커뮤니티 및 보조공학 동호회의 피드백을 통해 기술 신뢰도 확보.
Partnership: 국내 재활병원(국립재활원 등) 및 장애인 복지관과 협력하여 파일럿 테스트 진행.
5.2. 비즈니스 모델 (BM)
Phase 1 (MVP): 완전 무료 (Freemium). 사용자 확보 및 데이터(사용성 패턴) 축적에 집중.
Phase 2 (SaaS): 월 구독 모델 (Pro).
Free: 기기 3개 등록, 기본 시선 추적.
Pro ($5/mo): 무제한 기기, IoT 허브 연동, AI 음성 비서 커스텀.
Phase 3 (B2G): 정부 보조기기 지원 사업 등록을 통한 바우처 수익 모델.
6. 성공 지표 (Success Metrics)
MVP 런칭 후 3개월 내 달성해야 할 목표 수치.
Acquisition: 월간 활성 사용자(MAU) 500명 이상.
Activation: 신규 방문자의 캘리브레이션 완료 및 기기 등록 성공률 60% 이상.
Retention: 주 3회 이상 서비스를 재방문하는 사용자 비율 30% 이상.
Performance: 사용자 평균 Dwell Click 성공률 90% 달성.
7. 결론 (Conclusion)
All-Access Home은 기술적 과시가 아닌, **"가장 필요한 사람들에게 가장 적정(Appropriate)한 기술"**을 제공하는 데 의의가 있다.
기존 시장이 간과했던 **'웹 기반 공간 매핑(Web SLAM)'**과 **'멀티모달 입력'**의 결합은, 고비용 하드웨어 시장을 파괴(Disrupt)하고 보조공학의 대중화를 이끌 핵심 키(Key)가 될 것이다.
따라서 개발팀은 **화려한 3D 그래픽보다는 '저사양 기기 최적화'**에, **복잡한 기능보다는 '직관적인 UX'**에 집중하여 MVP를 개발해야 한다.