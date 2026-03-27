// 数据管理
const DB_KEY = 'studentScoreRecords';

// 等级顺序（从高到低）
const GRADE_ORDER = ['A+*', 'A', 'A-', 'B+*', 'B', 'B-', 'C', 'D'];
const GRADE_POINTS = {
    'A+*': 8, 'A': 7, 'A-': 6,
    'B+*': 5, 'B': 4, 'B-': 3,
    'C': 2, 'D': 1
};

// 获取所有数据
function getData() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : { students: [], records: [] };
}

// 保存数据
function saveData(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// 当前选中的学生ID
let currentStudentId = null;
let trendChart = null;

// 临时存储待上传的图片
let pendingWrongPhotos = [];
let pendingCorrectionPhotos = [];

// DOM 元素
const studentSelect = document.getElementById('studentSelect');
const addStudentBtn = document.getElementById('addStudentBtn');
const deleteStudentBtn = document.getElementById('deleteStudentBtn');
const studentModal = document.getElementById('studentModal');
const studentNameInput = document.getElementById('studentName');
const studentGradeSelect = document.getElementById('studentGrade');
const confirmAddStudent = document.getElementById('confirmAddStudent');
const cancelAddStudent = document.getElementById('cancelAddStudent');
const mainContent = document.getElementById('mainContent');
const noStudentMessage = document.getElementById('noStudentMessage');
const scoreForm = document.getElementById('scoreForm');
const examDateInput = document.getElementById('examDate');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 设置默认日期为今天
    examDateInput.valueAsDate = new Date();

    loadStudents();
    setupTabs();
    setupEventListeners();
    setupPhotoUpload();
});

// 加载学生列表
function loadStudents() {
    const data = getData();
    studentSelect.innerHTML = '<option value="">请选择学生</option>';

    data.students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.grade}年级)`;
        studentSelect.appendChild(option);
    });

    // 恢复上次选择的学生
    const lastStudent = localStorage.getItem('lastSelectedStudent');
    if (lastStudent && data.students.some(s => s.id === lastStudent)) {
        studentSelect.value = lastStudent;
        selectStudent(lastStudent);
    }
}

// 选择学生
function selectStudent(studentId) {
    currentStudentId = studentId;

    if (studentId) {
        mainContent.style.display = 'block';
        noStudentMessage.style.display = 'none';
        deleteStudentBtn.style.display = 'inline-block';
        localStorage.setItem('lastSelectedStudent', studentId);

        // 刷新各个标签页的数据
        loadHistory();
        updateStats();
    } else {
        mainContent.style.display = 'none';
        noStudentMessage.style.display = 'block';
        deleteStudentBtn.style.display = 'none';
    }
}

// 设置标签页切换
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab + 'Tab';

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            // 切换到统计标签时更新图表
            if (tab.dataset.tab === 'stats') {
                updateStats();
            }
        });
    });
}

// 设置事件监听
function setupEventListeners() {
    // 学生选择
    studentSelect.addEventListener('change', (e) => {
        selectStudent(e.target.value);
    });

    // 添加学生按钮
    addStudentBtn.addEventListener('click', () => {
        studentNameInput.value = '';
        studentGradeSelect.value = '1';
        studentModal.classList.add('active');
    });

    // 确认添加学生
    confirmAddStudent.addEventListener('click', () => {
        const name = studentNameInput.value.trim();
        const grade = studentGradeSelect.value;

        if (!name) {
            showToast('请输入学生姓名', 'error');
            return;
        }

        const data = getData();
        const newStudent = {
            id: 'student_' + Date.now(),
            name: name,
            grade: parseInt(grade),
            createdAt: new Date().toISOString()
        };

        data.students.push(newStudent);
        saveData(data);

        loadStudents();
        studentSelect.value = newStudent.id;
        selectStudent(newStudent.id);

        studentModal.classList.remove('active');
        showToast('学生添加成功！', 'success');
    });

    // 取消添加学生
    cancelAddStudent.addEventListener('click', () => {
        studentModal.classList.remove('active');
    });

    // 点击模态框外部关闭
    studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) {
            studentModal.classList.remove('active');
        }
    });

    // 删除学生
    deleteStudentBtn.addEventListener('click', () => {
        if (!currentStudentId) return;

        const data = getData();
        const student = data.students.find(s => s.id === currentStudentId);

        if (confirm(`确定要删除学生 "${student.name}" 及其所有成绩记录吗？此操作不可恢复！`)) {
            data.students = data.students.filter(s => s.id !== currentStudentId);
            data.records = data.records.filter(r => r.studentId !== currentStudentId);
            saveData(data);

            loadStudents();
            selectStudent('');
            showToast('学生已删除', 'success');
        }
    });

    // 成绩表单提交
    scoreForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveScore();
    });

    // 历史筛选
    document.getElementById('filterSemester').addEventListener('change', loadHistory);
    document.getElementById('filterType').addEventListener('change', loadHistory);

    // 统计筛选
    document.getElementById('statsPeriod').addEventListener('change', updateStats);
    document.getElementById('statsSemester').addEventListener('change', updateStats);
}

// 保存成绩
function saveScore() {
    if (!currentStudentId) {
        showToast('请先选择学生', 'error');
        return;
    }

    const chinese = document.getElementById('chineseScore').value;
    const math = document.getElementById('mathScore').value;
    const english = document.getElementById('englishScore').value;

    if (!chinese && !math && !english) {
        showToast('请至少选择一科成绩', 'error');
        return;
    }

    const record = {
        id: 'record_' + Date.now(),
        studentId: currentStudentId,
        date: document.getElementById('examDate').value,
        examType: document.getElementById('examType').value,
        semester: document.getElementById('semester').value,
        chinese: chinese || null,
        math: math || null,
        english: english || null,
        remarks: document.getElementById('remarks').value.trim(),
        wrongPhotos: [...pendingWrongPhotos],
        correctionPhotos: [...pendingCorrectionPhotos],
        createdAt: new Date().toISOString()
    };

    const data = getData();
    data.records.push(record);

    try {
        saveData(data);
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            showToast('存储空间不足，请删除一些旧记录', 'error');
            return;
        }
        throw e;
    }

    // 清空表单
    document.getElementById('chineseScore').value = '';
    document.getElementById('mathScore').value = '';
    document.getElementById('englishScore').value = '';
    document.getElementById('remarks').value = '';
    clearPhotoPreview();

    showToast('成绩保存成功！', 'success');
    loadHistory();
}

// 加载历史记录
function loadHistory() {
    if (!currentStudentId) return;

    const data = getData();
    const filterSemester = document.getElementById('filterSemester').value;
    const filterType = document.getElementById('filterType').value;

    let records = data.records
        .filter(r => r.studentId === currentStudentId)
        .filter(r => !filterSemester || r.semester === filterSemester)
        .filter(r => !filterType || r.examType === filterType)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const historyList = document.getElementById('historyList');

    if (records.length === 0) {
        historyList.innerHTML = '<p class="empty-message">暂无成绩记录</p>';
        return;
    }

    const examTypeNames = {
        daily: '日常测验',
        weekly: '周测',
        monthly: '月考',
        midterm: '期中考试',
        final: '期末考试'
    };

    historyList.innerHTML = records.map(record => {
        const hasWrongPhotos = record.wrongPhotos && record.wrongPhotos.length > 0;
        const hasCorrectionPhotos = record.correctionPhotos && record.correctionPhotos.length > 0;
        const hasPhotos = hasWrongPhotos || hasCorrectionPhotos;

        return `
        <div class="history-item" data-id="${record.id}">
            <div class="history-date">
                <div class="date">${formatDate(record.date)}</div>
                <div class="type">${examTypeNames[record.examType]}</div>
            </div>
            <div class="history-scores">
                <div class="history-score chinese">
                    <div class="subject">语文</div>
                    <div class="value">${record.chinese !== null ? record.chinese : '--'}</div>
                </div>
                <div class="history-score math">
                    <div class="subject">数学</div>
                    <div class="value">${record.math !== null ? record.math : '--'}</div>
                </div>
                <div class="history-score english">
                    <div class="subject">英语</div>
                    <div class="value">${record.english !== null ? record.english : '--'}</div>
                </div>
            </div>
            <div class="history-actions">
                <button class="btn-delete" onclick="deleteRecord('${record.id}')">删除</button>
            </div>
            ${hasPhotos ? `
            <div class="history-photos">
                ${hasWrongPhotos ? `
                <div class="history-photo-group">
                    <label>错题</label>
                    <div class="history-photo-thumbs">
                        ${record.wrongPhotos.map(p => `<img src="${p}" class="history-photo-thumb" onclick="viewPhoto('${p}')">`).join('')}
                    </div>
                </div>
                ` : ''}
                ${hasCorrectionPhotos ? `
                <div class="history-photo-group">
                    <label>订正</label>
                    <div class="history-photo-thumbs">
                        ${record.correctionPhotos.map(p => `<img src="${p}" class="history-photo-thumb" onclick="viewPhoto('${p}')">`).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
    `}).join('');
}

// 删除记录
function deleteRecord(recordId) {
    if (!confirm('确定要删除这条记录吗？')) return;

    const data = getData();
    data.records = data.records.filter(r => r.id !== recordId);
    saveData(data);

    loadHistory();
    updateStats();
    showToast('记录已删除', 'success');
}

// 更新统计
function updateStats() {
    if (!currentStudentId) return;

    const data = getData();
    const period = document.getElementById('statsPeriod').value;
    const semesterFilter = document.getElementById('statsSemester').value;

    let records = data.records
        .filter(r => r.studentId === currentStudentId)
        .filter(r => !semesterFilter || r.semester === semesterFilter)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 计算总体统计
    const chineseGrades = records.filter(r => r.chinese !== null).map(r => r.chinese);
    const mathGrades = records.filter(r => r.math !== null).map(r => r.math);
    const englishGrades = records.filter(r => r.english !== null).map(r => r.english);

    updateStatCard('chinese', chineseGrades);
    updateStatCard('math', mathGrades);
    updateStatCard('english', englishGrades);

    // 更新等级分布图
    updateGradeDistribution(chineseGrades, mathGrades, englishGrades);

    // 更新图表
    updateChart(records);

    // 更新分期统计
    updatePeriodStats(records, period);
}

// 计算等级分布
function getGradeDistribution(grades) {
    const dist = {};
    GRADE_ORDER.forEach(g => dist[g] = 0);
    grades.forEach(g => {
        if (dist[g] !== undefined) dist[g]++;
    });
    return dist;
}

// 获取最常见等级
function getModeGrade(grades) {
    if (grades.length === 0) return null;
    const dist = getGradeDistribution(grades);
    let maxCount = 0;
    let mode = null;
    GRADE_ORDER.forEach(g => {
        if (dist[g] > maxCount) {
            maxCount = dist[g];
            mode = g;
        }
    });
    return mode;
}

// 更新统计卡片
function updateStatCard(subject, grades) {
    const modeEl = document.getElementById(subject + 'Mode');
    const distribEl = document.getElementById(subject + 'Distrib');

    if (grades.length === 0) {
        modeEl.textContent = '--';
        distribEl.innerHTML = '<span>共 <b>0</b> 次</span>';
    } else {
        const mode = getModeGrade(grades);
        modeEl.textContent = mode || '--';

        // 统计A类和B类以上的数量
        const aCount = grades.filter(g => g && g.startsWith('A')).length;
        distribEl.innerHTML = `<span>共 <b>${grades.length}</b> 次</span><span>A类 <b>${aCount}</b> 次</span>`;
    }
}

// 更新等级分布图
function updateGradeDistribution(chinese, math, english) {
    const container = document.getElementById('gradeDistribution');

    if (chinese.length === 0 && math.length === 0 && english.length === 0) {
        container.innerHTML = '';
        return;
    }

    const chineseDist = getGradeDistribution(chinese);
    const mathDist = getGradeDistribution(math);
    const englishDist = getGradeDistribution(english);

    const maxCount = Math.max(
        ...Object.values(chineseDist),
        ...Object.values(mathDist),
        ...Object.values(englishDist),
        1
    );

    let html = '<h3>等级分布</h3><div class="grade-bars">';

    GRADE_ORDER.forEach(grade => {
        const cCount = chineseDist[grade];
        const mCount = mathDist[grade];
        const eCount = englishDist[grade];

        const cWidth = (cCount / maxCount * 100).toFixed(1);
        const mWidth = (mCount / maxCount * 100).toFixed(1);
        const eWidth = (eCount / maxCount * 100).toFixed(1);

        html += `
            <div class="grade-bar-row">
                <div class="grade-bar-label">${grade}</div>
                <div class="grade-bar-container">
                    <div class="grade-bar chinese" style="width: ${cWidth}%" title="语文: ${cCount}"></div>
                    <div class="grade-bar math" style="width: ${mWidth}%" title="数学: ${mCount}"></div>
                    <div class="grade-bar english" style="width: ${eWidth}%" title="英语: ${eCount}"></div>
                </div>
                <div class="grade-bar-count">语${cCount} 数${mCount} 英${eCount}</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// 更新趋势图
function updateChart(records) {
    const ctx = document.getElementById('trendChart').getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    if (records.length === 0) {
        return;
    }

    const labels = records.map(r => formatDate(r.date));
    // 将等级转换为数值
    const chineseData = records.map(r => r.chinese ? GRADE_POINTS[r.chinese] : null);
    const mathData = records.map(r => r.math ? GRADE_POINTS[r.math] : null);
    const englishData = records.map(r => r.english ? GRADE_POINTS[r.english] : null);

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '语文',
                    data: chineseData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: '数学',
                    data: mathData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: '英语',
                    data: englishData,
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.3,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const grade = Object.keys(GRADE_POINTS).find(
                                key => GRADE_POINTS[key] === context.raw
                            );
                            return `${context.dataset.label}: ${grade || '--'}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 9,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            const gradeLabels = ['', 'D', 'C', 'B-', 'B', 'B+*', 'A-', 'A', 'A+*'];
                            return gradeLabels[value] || '';
                        }
                    }
                }
            }
        }
    });
}

// 更新分期统计
function updatePeriodStats(records, period) {
    const container = document.getElementById('periodStats');

    if (records.length === 0) {
        container.innerHTML = '';
        return;
    }

    // 按周期分组
    const groups = {};

    records.forEach(record => {
        const date = new Date(record.date);
        let key;

        if (period === 'week') {
            // 获取周数
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
            key = `${date.getFullYear()}年第${weekNum}周`;
        } else if (period === 'month') {
            key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
        } else {
            key = record.semester.replace('-1', '年上学期').replace('-2', '年下学期');
        }

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(record);
    });

    // 生成统计HTML
    const html = Object.entries(groups).reverse().map(([key, groupRecords]) => {
        const chineseGrades = groupRecords.filter(r => r.chinese !== null).map(r => r.chinese);
        const mathGrades = groupRecords.filter(r => r.math !== null).map(r => r.math);
        const englishGrades = groupRecords.filter(r => r.english !== null).map(r => r.english);

        const chineseMode = getModeGrade(chineseGrades) || '--';
        const mathMode = getModeGrade(mathGrades) || '--';
        const englishMode = getModeGrade(englishGrades) || '--';

        return `
            <div class="period-stat-item">
                <h4>${key} (${groupRecords.length}次考试)</h4>
                <div class="period-stat-scores">
                    <span style="color: var(--chinese-color)">语文: ${chineseMode}</span>
                    <span style="color: var(--math-color)">数学: ${mathMode}</span>
                    <span style="color: var(--english-color)">英语: ${englishMode}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 显示提示
function showToast(message, type = 'info') {
    // 移除现有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2500);
}

// ========== 照片上传相关 ==========

// 设置照片上传
function setupPhotoUpload() {
    const wrongPhotoInput = document.getElementById('wrongPhoto');
    const correctionPhotoInput = document.getElementById('correctionPhoto');

    wrongPhotoInput.addEventListener('change', (e) => {
        handlePhotoSelect(e.target.files, 'wrong');
    });

    correctionPhotoInput.addEventListener('change', (e) => {
        handlePhotoSelect(e.target.files, 'correction');
    });
}

// 处理图片选择
async function handlePhotoSelect(files, type) {
    const previewId = type === 'wrong' ? 'wrongPhotoPreview' : 'correctionPhotoPreview';
    const preview = document.getElementById(previewId);
    const pendingArray = type === 'wrong' ? pendingWrongPhotos : pendingCorrectionPhotos;

    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        try {
            const compressed = await compressImage(file);
            pendingArray.push(compressed);
        } catch (err) {
            console.error('图片压缩失败:', err);
        }
    }

    updatePhotoPreview(preview, pendingArray, type);
}

// 压缩图片
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 限制最大尺寸为800px
                const maxSize = 800;
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // 压缩为JPEG，质量0.7
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 更新照片预览
function updatePhotoPreview(container, photos, type) {
    if (photos.length === 0) {
        container.innerHTML = '<span>点击拍照或选择图片</span>';
        container.classList.remove('has-photos');
        return;
    }

    container.classList.add('has-photos');
    container.innerHTML = photos.map((photo, index) => `
        <div class="preview-thumb-wrapper">
            <img src="${photo}" class="preview-thumb" onclick="viewPhoto('${photo}')">
            <button type="button" class="preview-thumb-remove" onclick="removePhoto('${type}', ${index})">×</button>
        </div>
    `).join('');
}

// 移除照片
function removePhoto(type, index) {
    event.stopPropagation();
    const previewId = type === 'wrong' ? 'wrongPhotoPreview' : 'correctionPhotoPreview';
    const preview = document.getElementById(previewId);

    if (type === 'wrong') {
        pendingWrongPhotos.splice(index, 1);
        updatePhotoPreview(preview, pendingWrongPhotos, type);
    } else {
        pendingCorrectionPhotos.splice(index, 1);
        updatePhotoPreview(preview, pendingCorrectionPhotos, type);
    }
}

// 查看大图
function viewPhoto(src) {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImg');
    img.src = src;
    modal.classList.add('active');
}

// 关闭照片模态框
function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('active');
}

// 点击模态框背景关闭
document.addEventListener('click', (e) => {
    const modal = document.getElementById('photoModal');
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// 清空照片预览
function clearPhotoPreview() {
    pendingWrongPhotos = [];
    pendingCorrectionPhotos = [];
    document.getElementById('wrongPhotoPreview').innerHTML = '<span>点击拍照或选择图片</span>';
    document.getElementById('wrongPhotoPreview').classList.remove('has-photos');
    document.getElementById('correctionPhotoPreview').innerHTML = '<span>点击拍照或选择图片</span>';
    document.getElementById('correctionPhotoPreview').classList.remove('has-photos');
    document.getElementById('wrongPhoto').value = '';
    document.getElementById('correctionPhoto').value = '';
}
