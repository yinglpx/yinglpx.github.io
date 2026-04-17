/**
 * SAM3 前端逻辑 - 支持框选、点选和3D生成（带可交互3D预览）
 */

class SAM3App {
    constructor() {
        this.apiBase = 'http://172.23.148.136:5000/api';
        this.initialized = false;
        this.imageLoaded = false;
        this.resultLoaded = false;
        this.currentModelData = false;
        this.promptMode = 'box'; // 'box', 'point_positive', 'point_negative'
        this.drawing = false;
        this.startX = 0;
        this.startY = 0;
        this.trueX = 0;
        this.trueY = 0;
        this.imageNaturalWidth = 0;
        this.imageNaturalHeight = 0;
        this.hasBox = false;
        
        // Three.js相关
        this.threeScene = null;
        this.threeCamera = null;
        this.threeRenderer = null;
        this.threeControls = null;
        this.threeModel = null;
        this.threeInitialized = false;
        this.THREE = null; // 保存THREE引用
        
        console.log('SAM3App 构造函数被调用');
        this.initElements();
        this.initEventListeners();
        
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => this.initialize(), 100);
        }
    }
    
    initElements() {
        console.log('初始化DOM元素');
        
        // 状态
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // 上传
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.imageInfo = document.getElementById('imageInfo');
        this.imageSize = document.getElementById('imageSize');
        
        // 图像显示
        this.originalImage = document.getElementById('originalImage');
        this.resultImage = document.getElementById('resultImage');
        
        // 3D容器
        this.view3dContainer = document.getElementById('view3dContainer');
        
        // 控制
        this.textPrompt = document.getElementById('textPrompt');
        this.segmentBtn = document.getElementById('segmentBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.downloadResultBtn = document.getElementById('downloadResultBtn');
        
        // 模式选择
        this.boxModeBtn = document.getElementById('boxModeBtn');
        this.pointPositiveBtn = document.getElementById('pointPositiveBtn');
        this.pointNegativeBtn = document.getElementById('pointNegativeBtn');
        
        // 提示计数
        this.boxCount = document.getElementById('boxCount');
        this.pointPositiveCount = document.getElementById('pointPositiveCount');
        this.pointNegativeCount = document.getElementById('pointNegativeCount');
        
        // 画布
        this.canvas = document.getElementById('promptCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // 统计
        this.statsPanel = document.getElementById('statsPanel');
        this.statCount = document.getElementById('statCount');
        this.statAvgConf = document.getElementById('statAvgConf');
        this.statTime = document.getElementById('statTime');
        
        // 提示
        this.tipButtons = document.querySelectorAll('.tip-btn');
        
        // 3D相关元素
        this.generate3DBtn = document.getElementById('generate3DBtn');
        this.addTextureBtn = document.getElementById('addTextureBtn');
        this.download3DBtn = document.getElementById('download3DBtn');
        this.modelFormatSelect = document.getElementById('modelFormatSelect');
        this.modelMetadata = document.getElementById('modelMetadata');
        this.modelFormat = document.getElementById('modelFormat');
        this.modelSize = document.getElementById('modelSize');
        this.modelVertices = document.getElementById('modelVertices');
        
        // 通知
        this.toast = document.getElementById('toast');
        this.loader = document.getElementById('loader');
        this.loaderMessage = document.getElementById('loaderMessage');
        
        // 初始状态
        if (this.uploadBtn) this.uploadBtn.disabled = true;
        if (this.segmentBtn) this.segmentBtn.disabled = true;
        if (this.generate3DBtn) this.generate3DBtn.disabled = true;
        if (this.download3DBtn) this.download3DBtn.disabled = true;
        if (this.addTextureBtn) this.addTextureBtn.disabled = true;
        if (this.statusText) this.statusText.textContent = '等待初始化...';
        
        // 初始化模式按钮状态
        this.updateModeButtons();
    }
    
    initEventListeners() {
        console.log('初始化事件监听器');
        
        // 上传区域点击
        if (this.uploadArea) {
            this.uploadArea.addEventListener('click', () => this.fileInput.click());
        }
        
        // 拖拽上传
        if (this.uploadArea) {
            this.uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.uploadArea.classList.add('dragover');
            });
            
            this.uploadArea.addEventListener('dragleave', () => {
                this.uploadArea.classList.remove('dragover');
            });
            
            this.uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                this.uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.fileInput.files = files;
                    this.uploadImage();
                }
            });
        }
        
        // 文件选择
        if (this.fileInput) {
            this.fileInput.addEventListener('change', () => this.uploadImage());
        }
        
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', () => this.uploadImage());
        }
        
        // 模式选择
        if (this.boxModeBtn) {
            this.boxModeBtn.addEventListener('click', () => {
                this.promptMode = 'box';
                this.updateModeButtons();
            });
        }
        
        if (this.pointPositiveBtn) {
            this.pointPositiveBtn.addEventListener('click', () => {
                this.promptMode = 'point_positive';
                this.updateModeButtons();
            });
        }
        
        if (this.pointNegativeBtn) {
            this.pointNegativeBtn.addEventListener('click', () => {
                this.promptMode = 'point_negative';
                this.updateModeButtons();
            });
        }
        
        // 画布事件
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
            this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        }
        
        // 分割按钮
        if (this.segmentBtn) {
            this.segmentBtn.addEventListener('click', () => this.segmentWithPrompts());
        }
        
        // 重置按钮
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.reset());
        }
        
        if (this.downloadResultBtn) {
            this.downloadResultBtn.addEventListener('click', () => this.downloadResult());
        }

        // 3D生成按钮
        if (this.generate3DBtn) {
            this.generate3DBtn.addEventListener('click', () => this.generate3D());
        }

        if (this.addTextureBtn) {
            this.addTextureBtn.addEventListener('click', () => this.addTexture());
        }
        
        // 3D下载按钮
        if (this.download3DBtn) {
            this.download3DBtn.addEventListener('click', () => this.download3D());
        }
        
        // 快速提示按钮
        if (this.tipButtons) {
            this.tipButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const text = btn.dataset.text;
                    if (this.textPrompt) {
                        this.textPrompt.value = text;
                        this.showToast(`已选择: ${btn.textContent.trim()}`, 'info');
                    }
                });
            });
        }
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter' && this.segmentBtn && !this.segmentBtn.disabled) {
                this.segmentWithPrompts();
            }
        });

        // 窗口大小变化时更新Three.js渲染器
        window.addEventListener('resize', () => {
            if (this.threeInitialized) {
                this.resizeThreeRenderer();
            }
        });
    }
    
    // 初始化Three.js场景
    async initThreeScene() {
        if (!this.view3dContainer) return;
        
        try {
            // 动态导入Three.js模块
            const THREE = await import('three');
            const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
            
            // 保存THREE引用供其他方法使用
            this.THREE = THREE;
            
            // 创建场景
            this.threeScene = new THREE.Scene();
            this.threeScene.background = new THREE.Color(0x1a1a1a);
            
            // 创建相机
            const aspect = this.view3dContainer.clientWidth / this.view3dContainer.clientHeight;
            this.threeCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
            this.threeCamera.position.set(5, 5, 5);
            this.threeCamera.lookAt(0, 0, 0);
            
            // 创建渲染器
            this.threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            this.threeRenderer.setSize(this.view3dContainer.clientWidth, this.view3dContainer.clientHeight);
            this.threeRenderer.setPixelRatio(window.devicePixelRatio);
            this.threeRenderer.shadowMap.enabled = true;
            this.threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.threeRenderer.toneMappingExposure = 1.0; // 降低曝光度
            
            // 清空容器并添加canvas
            while (this.view3dContainer.firstChild) {
                this.view3dContainer.removeChild(this.view3dContainer.firstChild);
            }
            this.view3dContainer.appendChild(this.threeRenderer.domElement);
            
            // 创建轨道控制器
            this.threeControls = new OrbitControls(this.threeCamera, this.threeRenderer.domElement);
            this.threeControls.enableDamping = true;
            this.threeControls.dampingFactor = 0.05;
            this.threeControls.screenSpacePanning = true;
            this.threeControls.maxPolarAngle = Math.PI;
            this.threeControls.minDistance = 2;
            this.threeControls.maxDistance = 20;
            
            // 添加环境光
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            this.threeScene.add(ambientLight);
            
            // 添加主光源
            const dirLight = new THREE.DirectionalLight(0xffffff, 1);
            dirLight.position.set(5, 8, 5);
            dirLight.castShadow = true;
            dirLight.receiveShadow = true;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            const d = 10;
            dirLight.shadow.camera.left = -d;
            dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d;
            dirLight.shadow.camera.bottom = -d;
            dirLight.shadow.camera.near = 1;
            dirLight.shadow.camera.far = 15;
            this.threeScene.add(dirLight);
            
            // 添加辅助光
            // const fillLight = new THREE.PointLight(0x446688, 0.5);
            // fillLight.position.set(-5, 0, 5);
            // this.threeScene.add(fillLight);

            // 3. 辅助光源 - 从背面和侧面补充照明
            const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
            backLight.position.set(-5, 0, -5);
            this.threeScene.add(backLight);
            
            const leftLight = new THREE.DirectionalLight(0xffffff, 0.8);
            leftLight.position.set(-5, 5, 0);
            this.threeScene.add(leftLight);
            
            const rightLight = new THREE.DirectionalLight(0xffffff, 0.8);
            rightLight.position.set(5, 5, 0);
            this.threeScene.add(rightLight);
            
            // 4. 点光源 - 从下方补充照明，让底部更清晰
            const bottomLight = new THREE.PointLight(0xffffff, 0.6);
            bottomLight.position.set(0, -5, 0);
            this.threeScene.add(bottomLight);
            
            // 5. 添加两个半球光，提供均匀的环境照明
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
            this.threeScene.add(hemiLight);
            
            // 6. 添加一些点光源围绕物体，确保各个角度都有光
            const positions = [
                [2, 2, 2], [-2, 2, 2], [2, 2, -2], [-2, 2, -2],
                [2, -2, 2], [-2, -2, 2], [2, -2, -2], [-2, -2, -2]
            ];
            
            positions.forEach(pos => {
                const pointLight = new THREE.PointLight(0xffffff, 0.3);
                pointLight.position.set(pos[0], pos[1], pos[2]);
                this.threeScene.add(pointLight);
            });
            
            // 添加网格地面
            const gridHelper = new THREE.GridHelper(10, 20, 0x888888, 0x444444);
            gridHelper.position.y = -0.5;
            this.threeScene.add(gridHelper);
            
            this.threeInitialized = true;
            
            // 开始动画循环
            this.animateThree();
            
            console.log('Three.js场景初始化成功');
        } catch (error) {
            console.error('Three.js初始化失败:', error);
        }
    }
    
    // Three.js动画循环
    animateThree() {
        if (!this.threeInitialized) return;
        
        requestAnimationFrame(() => this.animateThree());
        
        if (this.threeControls) {
            this.threeControls.update();
        }
        
        if (this.threeRenderer && this.threeScene && this.threeCamera) {
            this.threeRenderer.render(this.threeScene, this.threeCamera);
        }
    }
    
    // 调整渲染器大小
    resizeThreeRenderer() {
        if (!this.threeInitialized || !this.view3dContainer || !this.threeCamera || !this.threeRenderer) return;
        
        const width = this.view3dContainer.clientWidth;
        const height = this.view3dContainer.clientHeight;
        
        this.threeCamera.aspect = width / height;
        this.threeCamera.updateProjectionMatrix();
        this.threeRenderer.setSize(width, height);
    }
    
    updateModeButtons() {
        if (this.boxModeBtn) {
            this.boxModeBtn.classList.toggle('active', this.promptMode === 'box');
        }
        if (this.pointPositiveBtn) {
            this.pointPositiveBtn.classList.toggle('active', this.promptMode === 'point_positive');
        }
        if (this.pointNegativeBtn) {
            this.pointNegativeBtn.classList.toggle('active', this.promptMode === 'point_negative');
        }
    }
    
    onMouseDown(e) {
        if (!this.imageLoaded || !this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.startX = (e.clientX - rect.left) * scaleX;
        this.startY = (e.clientY - rect.top) * scaleY;

        if((this.imageNaturalWidth / this.imageNaturalHeight)>(rect.width / rect.height)){
            const h = this.imageNaturalHeight / this.imageNaturalWidth * rect.width;
            const disty = (rect.height - h) / 2;
            const scaleyy = this.imageNaturalHeight / h;
            this.trueY = (e.clientY - rect.top - disty) * scaleyy;
            this.trueX = (e.clientX - rect.left) / rect.width * this.imageNaturalWidth;
        }
        else{
            const w = this.imageNaturalWidth / this.imageNaturalHeight * rect.height;
            const distx = (rect.width - w) / 2;
            const scalexx = this.imageNaturalWidth / w;
            this.trueX = (e.clientX - rect.left - distx) * scalexx;
            this.trueY = (e.clientY - rect.top) / rect.height * this.imageNaturalHeight;
        }

        if (this.promptMode === 'box') {
            this.drawing = true;
        } else {
            this.addPoint(this.trueX, this.trueY);
        }
    }
    
    onMouseMove(e) {
        if (!this.drawing || !this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;
        
        this.redrawCanvas();
    
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(
            this.startX, this.startY,
            currentX - this.startX, currentY - this.startY
        );
    }
    
    onMouseUp(e) {
        if (!this.drawing || !this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        let eX, eY;

        if((this.imageNaturalWidth / this.imageNaturalHeight)>(rect.width / rect.height)){
            const h = this.imageNaturalHeight / this.imageNaturalWidth * rect.width;
            const disty = (rect.height - h) / 2;
            const scaleyy = this.imageNaturalHeight / h;
            eY = (e.clientY - rect.top - disty) * scaleyy;
            eX = (e.clientX - rect.left) / rect.width * this.imageNaturalWidth;
        }
        else{
            const w = this.imageNaturalWidth / this.imageNaturalHeight * rect.height;
            const distx = (rect.width - w) / 2;
            const scalexx = this.imageNaturalWidth / w;
            eX = (e.clientX - rect.left - distx) * scalexx;
            eY = (e.clientY - rect.top) / rect.height * this.imageNaturalHeight;
        }
        
        this.drawing = false;
        
        this.addBox(
            Math.min(this.trueX, eX),
            Math.min(this.trueY, eY),
            Math.max(this.trueX, eX),
            Math.max(this.trueY, eY)
        );
    }
    
    onMouseLeave() {
        this.drawing = false;
        this.redrawCanvas();
    }
    
    redrawCanvas() {
        if (!this.ctx || !this.originalImage) return;
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    async addBox(x1, y1, x2, y2) {
        this.showLoader('添加框选提示...');

        x1 = Math.max(0, Math.min(x1, this.imageNaturalWidth));
        y1 = Math.max(0, Math.min(y1, this.imageNaturalHeight));
        x2 = Math.max(0, Math.min(x2, this.imageNaturalWidth));
        y2 = Math.max(0, Math.min(y2, this.imageNaturalHeight));

        if (this.hasBox) {
            try {
                await fetch(`${this.apiBase}/reset`, {
                    method: 'POST'
                });
                console.log('已清除之前的框');
            } catch (error) {
                console.error('清除之前的框失败:', error);
            }
        }
        
        try {
            const response = await fetch(`${this.apiBase}/add_box`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    box: [x1, y1, x2, y2]
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.hasBox = true;
                this.resultLoaded = true;
                // 更新显示
                if (this.originalImage) {
                    this.originalImage.src = data.image;
                }

                if (this.resultImage) {
                    if (data.result_image) {
                        this.resultImage.src = data.result_image;
                        // 启用3D生成按钮
                        if (this.generate3DBtn) this.generate3DBtn.disabled = false;
                    } else {
                        // 如果没有分割结果，显示等待占位图
                        const resultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-family=\'system-ui\'%3E未检测到物体%3C/text%3E%3C/svg%3E';
                        this.resultImage.src = resultPlaceholder;
                    }
                }

                if (this.downloadResultBtn) {
                    this.downloadResultBtn.disabled = false;
                }
                
                // 更新计数
                this.updatePromptCounts(data.prompts);
                
                this.showToast('✅ 框选提示已添加', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showToast(`❌ ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }
    
    async addPoint(x, y) {
        this.showLoader('添加点选提示...');
        
        try {
            const response = await fetch(`${this.apiBase}/add_point`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    point: [x, y],
                    label: this.promptMode === 'point_positive'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.resultLoaded = true;
                // 更新显示
                if (this.originalImage) {
                    this.originalImage.src = data.image;
                }

                if (this.resultImage) {
                    if (data.result_image) {
                        this.resultImage.src = data.result_image;
                        // 启用3D生成按钮
                        if (this.generate3DBtn) this.generate3DBtn.disabled = false;
                    } else {
                        // 如果没有分割结果，显示等待占位图
                        const resultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-family=\'system-ui\'%3E未检测到物体%3C/text%3E%3C/svg%3E';
                        this.resultImage.src = resultPlaceholder;
                    }
                }
                
                if (this.downloadResultBtn) {
                    this.downloadResultBtn.disabled = false;
                }

                // 更新计数
                this.updatePromptCounts(data.prompts);
                
                const pointType = this.promptMode === 'point_positive' ? '正点' : '负点';
                this.showToast(`✅ ${pointType}提示已添加`, 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showToast(`❌ ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }
    
    updatePromptCounts(prompts) {
        if (this.boxCount) {
            this.boxCount.textContent = prompts.boxes.length;
        }
        if (this.pointPositiveCount || this.pointNegativeCount) {
            // 计算正点和负点的数量
            let positiveCount = 0;
            let negativeCount = 0;
            
            // 遍历 labels 数组统计正负点数量
            if (prompts.labels && prompts.labels.length > 0) {
                prompts.labels.forEach(label => {
                    if (label) {
                        positiveCount++;
                    } else {
                        negativeCount++;
                    }
                });
            }
            
            if (this.pointPositiveCount) {
                this.pointPositiveCount.textContent = positiveCount;
            }
            if (this.pointNegativeCount) {
                this.pointNegativeCount.textContent = negativeCount;
            }
        }
    }
    
    async initialize() {
        console.log('开始初始化系统...');
        this.showLoader('正在初始化系统...');
        
        try {
            if (this.statusText) {
                this.statusText.textContent = '初始化中...';
            }
            
            const response = await fetch(`${this.apiBase}/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.initialized = true;
                
                if (this.statusDot) this.statusDot.classList.add('connected');
                if (this.statusText) this.statusText.textContent = `已就绪 (${data.device})`;
                if (this.uploadBtn) this.uploadBtn.disabled = false;
                
                this.showToast('✅ 系统初始化成功', 'success');
                
                // 初始化Three.js场景
                this.initThreeScene();
                
            } else {
                throw new Error(data.message || '初始化失败');
            }
        } catch (error) {
            console.error('初始化错误:', error);
            
            if (this.statusText) {
                this.statusText.textContent = '初始化失败';
            }
            
            this.showToast(`❌ 初始化失败: ${error.message}`, 'error');
            
            setTimeout(() => this.initialize(), 5000);
        } finally {
            this.hideLoader();
        }
    }
    
    async uploadImage() {
        console.log('uploadImage 被调用');
        
        if (!this.initialized) {
            this.showToast('系统正在初始化，请稍候...', 'warning');
            this.initialize();
            return;
        }
        
        if (!this.fileInput) {
            console.error('fileInput 元素未找到');
            this.showToast('系统错误: 文件输入元素未找到', 'error');
            return;
        }
        
        const file = this.fileInput.files[0];
        if (!file) {
            this.showToast('请选择图片文件', 'warning');
            return;
        }
        
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            this.showToast('不支持的文件类型，请上传JPG、PNG或WEBP', 'error');
            return;
        }
        
        if (file.size > 16 * 1024 * 1024) {
            this.showToast('文件过大 (最大16MB)', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('image', file);
        
        this.showLoader('正在上传图片...');
        
        try {
            const response = await fetch(`${this.apiBase}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.hasBox = false;
                this.imageLoaded = true;
                this.resultLoaded = true;
                
                if (this.originalImage && data.image) {
                    this.originalImage.src = data.image;

                    // 设置画布尺寸
                    if (this.canvas) {
                        // this.canvas.width = data.width;
                        // this.canvas.height = data.height;
                        this.canvas.width = 800;
                        this.canvas.height = 600;
                        // 保存图像原始尺寸用于坐标转换
                        this.imageNaturalWidth = data.width;
                        this.imageNaturalHeight = data.height;
                    }
                }
                
                if (this.imageInfo) this.imageInfo.style.display = 'flex';
                if (this.imageSize) this.imageSize.textContent = `${data.width} x ${data.height}`;
                if (this.segmentBtn) this.segmentBtn.disabled = false;

                if (this.resultImage) {
                    if (data.result_image) {
                        this.resultImage.src = data.result_image;
                        // 启用3D生成按钮
                        if (this.generate3DBtn) this.generate3DBtn.disabled = false;
                    } else {
                        // 如果没有分割结果，显示等待占位图
                        const resultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-family=\'system-ui\'%3E未检测到物体%3C/text%3E%3C/svg%3E';
                        this.resultImage.src = resultPlaceholder;
                    }
                }

                // 重置3D预览
                if (this.threeInitialized && this.threeModel) {
                    // 移除当前模型
                    this.threeScene.remove(this.threeModel);
                    this.threeModel = null;
                }

                if (data.prompts) {
                    this.updatePromptCounts(data.prompts);
                } else {
                    // 如果后端没有返回prompts，手动归零
                    if (this.boxCount) this.boxCount.textContent = '0';
                    if (this.pointPositiveCount) this.pointPositiveCount.textContent = '0';
                    if (this.pointNegativeCount) this.pointNegativeCount.textContent = '0';
                }

                if (this.downloadResultBtn) {
                    this.downloadResultBtn.disabled = false;
                }
                
                this.showToast(`✅ ${data.message}`, 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('上传错误:', error);
            this.showToast(`❌ ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async downloadResult() {
        console.log('downloadResult 被调用');
        
        if (!this.resultLoaded) {
            this.showToast('没有可用的分割图片', 'warning');
            return;
        }
        
        try {
            this.showLoader('正在准备下载...');
            
            // 发送请求获取图片
            const response = await fetch(`${this.apiBase}/download_result`, {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
            }
            
            // 获取 blob 数据
            const blob = await response.blob();
            
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'segmented_result.png';
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理 URL 对象
            window.URL.revokeObjectURL(url);
            
            this.showToast('✅ 图片下载已开始', 'success');
        } catch (error) {
            console.error('下载图片错误:', error);
            this.showToast(`❌ 下载失败: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }
    
    async segmentWithPrompts() {
        console.log('segmentWithPrompts 被调用');
        
        if (!this.initialized) {
            this.showToast('系统未初始化', 'warning');
            return;
        }
        
        if (!this.imageLoaded) {
            this.showToast('请先上传图片', 'warning');
            return;
        }
        
        const text = this.textPrompt ? this.textPrompt.value.trim() : '';
        
        this.showLoader('正在分割图像...');
        
        try {
            const response = await fetch(`${this.apiBase}/segment_with_prompts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.resultLoaded = true;
                if (this.resultImage && data.image) {
                    this.resultImage.src = data.image;
                    // 启用3D生成按钮
                    if (this.generate3DBtn) this.generate3DBtn.disabled = false;
                }

                if (this.downloadResultBtn) {
                    this.downloadResultBtn.disabled = false;
                }
                
                this.showToast(`✅ ${data.message}`, 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('分割错误:', error);
            this.showToast(`❌ ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async reset() {
        console.log('reset 被调用');
        
        this.showLoader('正在重置...');
        
        try {
            const response = await fetch(`${this.apiBase}/reset`, {
                method: 'POST'
            });
            
            const data = await response.json();
            console.log('重置响应:', data);
            
            if (data.success) {
                this.hasBox = false;
                this.resultLoaded = false;
                this.currentModelData = false
                // 1. 更新原始图像（清除所有绘制的提示）
                if (this.originalImage && data.image) {
                    this.originalImage.src = data.image;
                }
                
                // 2. 清除分割结果图像
                const resultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-family=\'system-ui\'%3E等待分割%3C/text%3E%3C/svg%3E';
                if (this.resultImage) this.resultImage.src = resultPlaceholder;
                
                // 3. 重置3D预览
                if (this.threeInitialized && this.threeModel) {
                    this.threeScene.remove(this.threeModel);
                    this.threeModel = null;
                }
                
                // 4. 隐藏元数据
                if (this.modelMetadata) this.modelMetadata.style.display = 'none';
                if (this.download3DBtn) this.download3DBtn.disabled = true;
                if (this.generate3DBtn) this.generate3DBtn.disabled = true;
                
                // 5. 更新提示计数（全部归零）
                if (data.prompts) {
                    this.updatePromptCounts(data.prompts);
                } else {
                    if (this.boxCount) this.boxCount.textContent = '0';
                    if (this.pointPositiveCount) this.pointPositiveCount.textContent = '0';
                    if (this.pointNegativeCount) this.pointNegativeCount.textContent = '0';
                }
                
                // 6. 隐藏统计面板
                if (this.statsPanel) this.statsPanel.style.display = 'none';
                
                // 7. 清空文本输入
                if (this.textPrompt) this.textPrompt.value = '';
                
                // 8. 重置画布
                if (this.ctx && this.canvas) {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                }

                if (this.downloadResultBtn) this.downloadResultBtn.disabled = true;
                if (this.addTextureBtn) this.addTextureBtn.disabled = true;
                
                this.showToast('✅ 已重置到原始图像，所有提示已清除', 'success');
            }
        } catch (error) {
            console.error('重置错误:', error);
            this.showToast(`❌ 重置失败: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }
    
    async generate3D() {
        console.log('generate3D 被调用');
        
        if ((!this.imageLoaded)||(!this.resultLoaded)) {
            this.showToast('请先上传并分割图像', 'warning');
            return;
        }
        
        const format = this.modelFormatSelect ? this.modelFormatSelect.value : 'glb';
        
        this.showLoader('正在生成3D模型，请稍候...');
        
        try {
            const response = await fetch(`${this.apiBase}/triposg/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    format: format,
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 显示元数据
                this.currentModelData = true;
                if (this.modelMetadata && data.metadata) {
                    if (this.modelFormat) this.modelFormat.textContent = data.format.toUpperCase();
                    if (this.modelSize) this.modelSize.textContent = this.formatFileSize(data.metadata.size || 0);
                    if (this.modelVertices) this.modelVertices.textContent = data.metadata.vertices || 0;
                    this.modelMetadata.style.display = 'block';
                }
                
                if (data.model_data) {
                    await this.loadModelFromDataURL(data.model_data);
                }

                // 启用下载按钮
                if (this.download3DBtn) {
                    this.download3DBtn.disabled = false;
                }
                if (this.addTextureBtn) {
                    this.addTextureBtn.disabled = false;  // 启用纹理按钮
                }
                
                this.showToast(`✅ 3D模型生成成功 (${format})`, 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('3D生成错误:', error);
            this.showToast(`❌ ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }
    
    // 从Data URL加载模型的方法
    async loadModelFromDataURL(dataURL) {
        if (!this.threeInitialized) {
            await this.initThreeScene();
        }
        
        this.showLoader('加载3D模型...');
        
        try {
            const base64Data = dataURL.split(',')[1];
            
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            await this.loadGLTFFromBuffer(bytes.buffer, 'glb');
            // if (format === 'glb' || format === 'gltf') {
            //     await this.loadGLTFFromBuffer(bytes.buffer, format);
            // } else if (format === 'obj') {
            //     await this.loadOBJFromBuffer(bytes.buffer);
            // } else {
            //     this.showToast(`不支持的模型格式: ${format}`, 'error');
            //     this.hideLoader();
            // }
        } catch (error) {
            console.error('处理模型数据失败:', error);
            this.showToast('❌ 模型数据解析失败', 'error');
            this.hideLoader();
        }
    }

    // 从Buffer加载GLTF/GLB模型
    async loadGLTFFromBuffer(buffer, format) {
        try {
            // 动态导入所需的模块
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            
            const loader = new GLTFLoader();
            
            // 将ArrayBuffer转换为Blob URL
            const blob = new Blob([buffer], { type: format === 'glb' ? 'model/gltf-binary' : 'model/gltf+json' });
            const url = URL.createObjectURL(blob);
            
            loader.load(
                url,
                (gltf) => {
                    // 移除当前模型
                    if (this.threeModel) {
                        this.threeScene.remove(this.threeModel);
                    }
                    
                    // 添加新模型
                    this.threeModel = gltf.scene;
                    
                    // 计算并居中模型
                    const box = new THREE.Box3().setFromObject(this.threeModel);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    this.threeModel.position.x -= center.x;
                    this.threeModel.position.y -= center.y;
                    this.threeModel.position.z -= center.z;
                    
                    // 缩放模型到合适大小
                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 0) {
                        const scale = 2.0 / maxDim;
                        this.threeModel.scale.set(scale, scale, scale);
                    }
                    
                    // 启用阴影
                    this.threeModel.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });
                    
                    this.threeScene.add(this.threeModel);
                    
                    // 重置相机
                    this.threeCamera.position.set(3, 2, 5);
                    this.threeControls.target.set(0, 0, 0);
                    this.threeControls.update();
                    
                    // 清理Blob URL
                    URL.revokeObjectURL(url);
                    this.hideLoader();
                    console.log('3D模型加载成功');
                },
                (progress) => {
                    console.log(`加载进度: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
                },
                (error) => {
                    console.error('模型加载失败:', error);
                    URL.revokeObjectURL(url);
                    this.hideLoader();
                    this.showToast('❌ 模型加载失败', 'error');
                }
            );
        } catch (error) {
            console.error('加载GLTFLoader失败:', error);
            this.hideLoader();
            this.showToast('❌ 3D模块加载失败', 'error');
        }
    }

    // // 从Buffer加载OBJ模型
    // async loadOBJFromBuffer(buffer) {
    //     try {
    //         // 动态导入所需的模块
    //         const THREE = await import('three');
    //         const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
            
    //         const loader = new OBJLoader();
            
    //         // 将ArrayBuffer转换为字符串
    //         const decoder = new TextDecoder('utf-8');
    //         const objString = decoder.decode(buffer);
            
    //         try {
    //             // 解析OBJ字符串
    //             const object = loader.parse(objString);
                
    //             // 移除当前模型
    //             if (this.threeModel) {
    //                 this.threeScene.remove(this.threeModel);
    //             }
                
    //             this.threeModel = object;
                
    //             // 计算并居中
    //             const box = new THREE.Box3().setFromObject(this.threeModel);
    //             const center = box.getCenter(new THREE.Vector3());
    //             const size = box.getSize(new THREE.Vector3());
                
    //             this.threeModel.position.x -= center.x;
    //             this.threeModel.position.y -= center.y;
    //             this.threeModel.position.z -= center.z;
                
    //             const maxDim = Math.max(size.x, size.y, size.z);
    //             if (maxDim > 0) {
    //                 const scale = 2.0 / maxDim;
    //                 this.threeModel.scale.set(scale, scale, scale);
    //             }
                
    //             this.threeModel.traverse((node) => {
    //                 if (node.isMesh) {
    //                     node.castShadow = true;
    //                     node.receiveShadow = true;
    //                 }
    //             });
                
    //             this.threeScene.add(this.threeModel);
                
    //             this.threeCamera.position.set(3, 2, 5);
    //             this.threeControls.target.set(0, 0, 0);
    //             this.threeControls.update();
                
    //             this.hideLoader();
    //             console.log('OBJ模型加载成功');
    //         } catch (error) {
    //             console.error('OBJ模型解析失败:', error);
    //             this.hideLoader();
    //             this.showToast('❌ OBJ模型解析失败', 'error');
    //         }
    //     } catch (error) {
    //         console.error('加载OBJLoader失败:', error);
    //         this.hideLoader();
    //     }
    // }

    async download3D() {
        console.log('download3D 被调用');
        const format = this.modelFormatSelect ? this.modelFormatSelect.value : 'glb';
        
        try {
            this.showLoader('正在准备下载...');
        
            // 发送请求获取模型文件
            const response = await fetch(`${this.apiBase}/triposg/download?format=${format}`, {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
            }
            
            // 获取文件名（从响应头或使用默认名称）
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'model.${format}';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // 获取 blob 数据
            const blob = await response.blob();
            
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理 URL 对象
            window.URL.revokeObjectURL(url);
            
        this.showToast('✅ 模型下载已开始', 'success');
        } catch (error) {
            console.error('下载错误:', error);
            this.showToast(`❌ ${error.message}`, 'error');
        }finally {
            this.hideLoader();
        }
    }

    async addTexture() {
        console.log('addTexture 被调用');
        
        if (!this.resultLoaded) {
            this.showToast('请先上传并分割图像', 'warning');
            return;
        }
        
        if (!this.currentModelData) {
            this.showToast('请先生成3D模型', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/triposg/add_texture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            });
            
            const data = await response.json();
            console.log('添加纹理响应:', data);
            
            if (data.success) {
                // 更新模型数据（带纹理的模型）
                if (data.model_data) {
                    this.currentModelData = data.model_data;
                    await this.loadModelFromDataURL(data.model_data);
                }
                
                // 更新元数据
                if (this.modelMetadata && data.metadata) {
                    if (this.modelFormat) this.modelFormat.textContent = data.format.toUpperCase();
                    if (this.modelSize) this.modelSize.textContent = this.formatFileSize(data.metadata.size || 0);
                    if (this.modelVertices) this.modelVertices.textContent = data.metadata.vertices || 0;
                    this.modelMetadata.style.display = 'block';
                }
                
                this.showToast(`✅ 纹理添加成功`, 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('添加纹理错误:', error);
            this.showToast(`❌ 添加纹理失败: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    showToast(message, type = 'info') {
        if (!this.toast) {
            alert(message);
            return;
        }
        
        this.toast.textContent = message;
        this.toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
    
    showLoader(message) {
        if (!this.loader || !this.loaderMessage) return;
        
        this.loaderMessage.textContent = message || '处理中...';
        this.loader.style.display = 'flex';
    }
    
    hideLoader() {
        if (!this.loader) return;
        this.loader.style.display = 'none';
    }
}

// 启动应用
(function() {
    function initApp() {
        window.app = new SAM3App();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();