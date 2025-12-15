SLAM 개발에 유용한 라이브러리
Posted on 2022-01-08
Edited on 2024-08-26
In 1. Spatial AI , 1.1 SLAM
Views: 6289
C++ 개발에 유용한 라이브러리들은 여기를 봐주세요!

라이브러리마다 3줄 요약 + 링크를 남깁니다.

영상처리
OpenCV
제일 많이 사용되는 영상처리 라이브러리!
왠만한 플랫폼에 적용 가능 + 왠만한 영상 알고리즘 성능의 베이스라인
개인적으로 생각하는 SLAM 개발자의 필수 라이브러리

링크
웹사이트
GitHub
EmguCV
OpenCV의 C# 버전
C# 유니티를 쓰면서 필요하다면 쓸 수 있겠지만, 개인적으로는 C++ 모듈로 개발한 다음에 export하는 것을 추천
블로그 글 순서 상 여기에 적었지만, 사실 그렇게 추천하는 라이브러리는 아님

링크
GitHub
FastCV
ARM 코어 + Snapdragon Mobile CPU에서 가속이 잘 되도록 만든 컴퓨터 비전 라이브러리
모바일 전용 영상처리가 필요할 때 좋을 듯

링크
웹사이트
API doc
OpenGV
3D geometric vision을 위한 minimal / non-minimal solver 알고리즘들을 모아놓은 라이브러리
EPnP, P3P와 같은 알고리즘 구현체가 상당히 좋음

링크
웹사이트 / API doc
논문: Kneip 2014 - OpenGV: A Unified and Generalized Approach to Real-Time Calibrated Geometric Vision
PCL
포인트 클라우드 프로세싱 라이브러리
LiDAR SLAM, RGB-D SLAM을 한다면 필수로 사용하는 라이브러리
OpenCV에 더불어 사용할 수 있으면 매우 도움이 됨

링크
웹사이트
GitHub
Open3D
PCL을 위협하는 최신 라이브러리
하지만 아직 첫번째 메이저 릴리즈가 진행되지 않았음 (i.e. 조금 불안정할수도?)
딥러닝 기능들과도 밀접한 연관을 가지고 있기 때문에, 최신 연구를 한다면 강력하게 추천

링크
웹사이트
GitHub
GML Camera Calibration Toolbox
쓰기 쉬운 카메라 캘리브레이션 앱
Camera coefficient를 4개까지 계산할 수 있다.
스마트폰 카메라처럼 화각이 넓은 카메라를 쓴다면 OpenCV 카메라 캘리브레이션을 추천한다

링크
웹사이트 (요즘 좀좀 링크가 다운되는듯?)
Windows용 파일 다운로드
Android camera calibration
안드로이드 모바일에서 카메라 캘리브레이션 하는 앱
OpenCV3와 Camera2 API를 이용함

링크
GitHub 링크
COLMAP
Structure-from-Motion / Multi-View Stereo 라이브러리
3D reconstruction 또는 Visual localization을 연구하려면 필수

링크
웹사이트
GitHub
FFmpeg
동영상 처리 라이브러리
OpenCV에 포함시켜 빌드 할 수 있음 (이 방법이 더 쓰기 쉬움…)

링크
웹사이트
OpenMVS
COLMAP이나 OpenMVG가 하지 못하는 full surface reconstruction을 수행하는 라이브러리

링크
GitHub
OpenMVG
COLMAP 과 비슷한 용도의 라이브러리

링크
GitHub
OpenSfM
Mapillary에서 만든 Python 기반 Structure-from-Motion 라이브러리

링크
GitHub
Meshroom
Point cloud의 시각화하여 후처리 및= 분석을 할 수 있는 프로그램.

링크
웹사이트
ARM Compute Library
ARM CPU/GPU코어에서 빠른 딥러닝 연산을 위한 라이브러리

링크
웹사이트
vilib
VIO 프론트엔드를 CUDA 가속 시킨 라이브러리

링크
GitHub
REMODE
Probabilistic dense map을 생성해서 sparse -> dense point cloud를 만드는 라이브러리

링크
GitHub
Deprecated…
CVD
Metaio SDK

수학 / 최적화
Eigen
가장 많이 사용되는 선형대수 라이브러리
3D geometric vision을 한다면 거의 필수적으로 사용하는 라이브러리
로우레벨 알고리즘을 직접 구현한다면 거의 필수적으로 사용하는 라이브러리

링크
웹사이트
[GitLab]
Cheat sheet
BLAS + ATLAS + LAPACK
많은 선형대수 라이브러리의 백엔드로 사용되는 라이브러리
… 정말로 로우레벨로 내려갈게 아니라면 사용할 일 없는 라이브러리. 지식 채움 용도로만 사용하는 것을 추천.
Fotran으로 작성되어있고, 왠만하면 C래퍼로 된 라이브러리를 사용하는편.

링크
BLAS 웹사이트
LAPACK 웹사이트
Ceres-solver
비선형 최적화 라이브러리
g2o, GTSAM과 더불어 가장 많이 사용되는 SLAM 백엔드 라이브러리
커스텀 cost function을 짤 수 있는게 가장 큰 장점! 초심자부터 고수까지 쓰기 좋음.

링크
웹사이트
GitHub
g2o
Graph optimization 라이브러리
SLAM 백엔드로 사용하기에 난이도가 낮지만, 성능이 다른 라이브러리에 비해 낮은 편

링크
GitHub
GTSAM
Factor graph 기반 로보틱스 센서퓨전 라이브러리
SLAM 백엔드로 쓰기에 아주 좋은 라이브러리 - 특히나 IMU를 사용한다면 Pre-integration 알고리즘이 이미 들어가있음

링크
웹페이지
GitHub
SE-Sync
비교적 최근에 공개된 SLAM 백엔드 라이브러리
Global minimum을 찾을 수 있는 최적화 알고리즘을 사용한다고 함

링크
GitHub
Sophus
최적화를 위한 Lie algebra / Lie group 라이브러리

링크
GitHub
Manif
비교적 최근에 나온 최적화를 위한 Lie 이론 알고리즘 라이브러리

링크
GitHub

딥러닝
TensorFlow / PyTorch / MxNet
딥러닝 필수 라이브러리
C++ API도 있음

링크
TensorFlow 웹사이트
PyTorch 웹사이트
mxnet 웹사이트
Detectron 2
General object detection, segmentation, pose estimation 및 기타 딥러닝 기반 비전 태스크 라이브러리

링크
GitHub
DarkNet
C와 CUDA로 작성되어있는 딥러닝 라이브러리
대표적인 알고리즘으로는 YOLO가 있음

링크
웹사이트
GitHub
DLib
C++ 머신러닝 라이브러리
SVM와 같은 고전 머신러닝 알고리즘 사용 가능
Face landmark detection과 같은 딥러닝 기능도 사용 가능

링크
웹사이트
DBoW2 / DBoW3 / FBoW
DBoW2 - ORB-SLAM에서 Loop closure detection을 위해 사용하는 라이브러리
DBoW3 - DBoW2를 개선시켰다고 주장하는 라이브러리
FBoW - DBoW3에 하드웨어 가속을 적용한 라이브러리

링크
DBoW2 GitHub
DBoW3 GitHub
FBoW GitHub
SNPE SDK
Qualcomm Snapdragon 칩에서 빠르게 딥러닝 기능을 작동시킬 수 있는 라이브러리 - Snapdragon CPU, Adreno GPU, Hexagon DSP
Caffe, Caffe2, ONNX, TensorFlow 모델을 Snapdragon에서 가속시킬 수 있는 형태로 변환 가능

Snapdragon Neural Processing Engine

링크

웹사이트
Docs

시뮬레이션
CARLA
가장 유명한 자율주행 시나리오 시뮬레이터

링크
웹사이트
GitHub
Habitat-Sim + Replica
인도어 환경에서 다양한 비전/언어 태스크를 수행할 수 있도록 만들어진 시뮬레이터

링크
웹사이트
GitHub
AirSim
Unity / Unreal Engine의 플러그인으로써, 게임 엔진 속 세상에 자동차/드론을 사용하는 시뮬레이터

링크

웹사이트
GitHub
NVIDIA Omniverse / Isaac Sim
최근 NVIDIA에서 공개한 Omniverse 그래픽 엔진 + ISAAC 로보틱스 시뮬레이터

링크
웹사이트
Gazebo
ROS에서 많이 사용하는 시뮬레이터
최신 시뮬레이터들에 비해 그래픽은 많이 부족한 편

링크
웹사이트
GitHub

그래픽스 / 렌더링
OpenGL
그래픽스 렌더링을 위해 가장 많이 사용되는 API
수많은 엔진들이 OpenGL 기반으로 되어있음

링크
OpenGL 공부 웹사이트
Vulkan
크로스 컴파일이 가능한 그래픽스 API
OpenGL에 비해 훨씬 어렵지만, 그만큼 컨트롤 할 수 있는 부분도 많다고 한다.

링크
Vulkan 공부 웹사이트
Metal
Apple 제품 및 맥북에서 사용 가능한 그래픽스 API

Qt
크로스 컴파일이 가능한 GUI 앱 개발 프레임워크
OpenGL의 난이도에 크로스 컴파일 기능이 들어간 정도

링크
웹사이트
Filament
크로스 컴파일이 가능한 물리 렌더링 엔진
OpenGL을 할 수 있다면 이 라이브러리를 적극 추천함

링크
GitHub
Pangolin
오픈소스 SLAM에서 많이 사용하는 3D 시각화 라이브러리
성능이 그렇게 좋은 편은 아니지만, OpenCV나 OpenGL을 알면 쉽게 쓸 수 있도록 되어있다

링크
GitHub
rviz
ROS에서 많이 사용되는 3D 시각화 라이브러리

링크
웹사이트
GitHub
Ogre, GODOT, Hazel, VTK, ITK
가벼운 3D 게임 / 렌더링 엔진

링크
Ogre 웹사이트
GODOT 웹사이트
Hazel 웹사이트
VTK 웹사이트

통신
gRPC
고성능 RPC 프레임워크

링크
웹사이트
rpcLib
클라이언트~서버 간의 rpc 통신을 위한 라이브러리

링크
웹사이트
lcm
가벼운 메세지 통신 및 data marshalling 라이브러리

링크
GitHub
