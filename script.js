document.addEventListener('DOMContentLoaded', () => {
    // Set dynamic copyright year
    document.getElementById('copyright-year').textContent = new Date().getFullYear();

    // Element References
    const recordTypeSelect = document.getElementById('record-type');
    const subjectWrapper = document.getElementById('subject-wrapper');
    const singleFileBtn = document.getElementById('single-file-btn');
    const individualFilesBtn = document.getElementById('individual-files-btn');
    const singleFileUploadArea = document.getElementById('single-file-upload-area');
    const individualFilesUploadArea = document.getElementById('individual-files-upload-area');
    const downloadExcelTemplateBtn = document.getElementById('download-excel-template');
    const uploadExcelBtn = document.getElementById('upload-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    const fileInput = document.getElementById('file-input');
    const progressSection = document.getElementById('progress-section');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const resultSection = document.getElementById('result-section');
    const resultTableBody = document.querySelector('#result-table tbody');
    const copyResultsBtn = document.getElementById('copy-results');
    const resetDataBtn = document.getElementById('reset-data');
    const detailsModal = document.getElementById('details-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const interactiveSections = document.querySelectorAll('.interactive-section');

    let studentData = {}; // { studentId: { content: '', originalContent: '', reasoning: '' } }

    // --- Initialization ---
    loadFormData();

    // --- Event Listeners ---
    recordTypeSelect.addEventListener('change', toggleSubjectVisibility);

    interactiveSections.forEach(section => {
        section.addEventListener('focusin', () => {
            interactiveSections.forEach(s => s.classList.remove('animate-pop'));
            section.classList.add('animate-pop');
            section.addEventListener('animationend', () => {
                section.classList.remove('animate-pop');
            }, {
                once: true
            });
        });
    });

    singleFileBtn.addEventListener('click', () => {
        singleFileUploadArea.classList.remove('hidden');
        individualFilesUploadArea.classList.add('hidden');
        singleFileBtn.classList.add('border-indigo-400', 'bg-indigo-50');
        individualFilesBtn.classList.remove('border-violet-400', 'bg-violet-50');
    });

    individualFilesBtn.addEventListener('click', () => {
        individualFilesUploadArea.classList.remove('hidden');
        singleFileUploadArea.classList.add('hidden');
        individualFilesBtn.classList.add('border-violet-400', 'bg-violet-50');
        singleFileBtn.classList.remove('border-indigo-400', 'bg-indigo-50');
    });

    downloadExcelTemplateBtn.addEventListener('click', downloadExcelTemplate);
    uploadExcelBtn.addEventListener('click', () => excelFileInput.click());
    excelFileInput.addEventListener('change', handleExcelUpload);
    fileInput.addEventListener('change', handleIndividualFilesUpload);

    const inputsToSave = document.querySelectorAll('#curriculum-info, #class-activity-info, #record-type, #subject, #guidelines, #start-phrase');
    inputsToSave.forEach(input => {
        input.addEventListener('input', saveFormData);
    });

    copyResultsBtn.addEventListener('click', copyResultsToClipboard);
    resetDataBtn.addEventListener('click', resetAllData);
    closeModalBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));

    // --- Functions ---

    function resetAllData() {
        if (confirm('정말로 모든 생성 결과를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            resultSection.classList.add('hidden');
            progressSection.classList.add('hidden');
            resultTableBody.innerHTML = '';
            studentData = {};
            fileInput.value = '';
            excelFileInput.value = '';
            singleFileUploadArea.classList.add('hidden');
            individualFilesUploadArea.classList.add('hidden');
            singleFileBtn.classList.remove('border-indigo-400', 'bg-indigo-50');
            individualFilesBtn.classList.remove('border-violet-400', 'bg-violet-50');
        }
    }

    function handleDeleteClick(event) {
        const studentId = event.currentTarget.dataset.id;
        if (confirm(`${studentId} 학번의 자료를 삭제하시겠습니까?`)) {
            const row = document.getElementById(`row-${studentId}`);
            if (row) {
                row.remove();
                delete studentData[studentId];
            }
            if (resultTableBody.querySelectorAll('tr').length === 0) {
                resultSection.classList.add('hidden');
                progressSection.classList.add('hidden');
            }
        }
    }

    function toggleSubjectVisibility() {
        if (recordTypeSelect.value === '교과세특') {
            subjectWrapper.classList.remove('hidden');
        } else {
            subjectWrapper.classList.add('hidden');
        }
    }

    function downloadExcelTemplate() {
        const worksheet = XLSX.utils.json_to_sheet([{
            "학번": "20501",
            "이름": "김민준",
            "활동내용": "여기에 학생의 활동 내용을 상세히 입력하세요."
        }, {
            "학번": "20502",
            "이름": "이서아",
            "활동내용": "보고서, 탐구활동, 발표 등 구체적인 내용을 작성합니다."
        }]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "활동 기록");
        XLSX.writeFile(workbook, "특기사항_입력_양식.xlsx");
    }

    async function handleExcelUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {
                type: 'array'
            });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const excelData = XLSX.utils.sheet_to_json(worksheet);

            if (!excelData.length || !excelData[0]['학번'] || !excelData[0]['활동내용']) {
                alert('엑셀 파일의 헤더(첫 번째 행)에 "학번"과 "활동내용"이 포함되어 있는지 확인해주세요.');
                return;
            }

            await processData(excelData.map(row => ({
                id: String(row['학번']).trim(),
                content: String(row['활동내용']).trim()
            })));
        };
        reader.readAsArrayBuffer(file);
    }

    async function handleIndividualFilesUpload(event) {
        const files = event.target.files;
        if (!files.length) return;

        const filePromises = Array.from(files).map(async file => {
            const studentId = file.name.split('.')[0].trim();
            const content = await readFileContent(file);
            return {
                id: studentId,
                content: content.trim()
            };
        });

        const dataToProcess = await Promise.all(filePromises);
        await processData(dataToProcess);
    }

    async function processData(data) {
        if (!data.length) return;

        resetUI();
        progressSection.classList.remove('hidden');
        resultSection.classList.remove('hidden');

        let processedCount = 0;
        for (const item of data) {
            const {
                id,
                content
            } = item;
            studentData[id] = {
                content: '',
                originalContent: content,
                reasoning: ''
            };

            try {
                const resultText = await callGenerativeAPI(content, '중');
                studentData[id].content = resultText;
                addResultRow(id, resultText);
            } catch (error) {
                console.error(`Error processing for ${id}:`, error);
                addErrorRow(id, error.message);
            }

            processedCount++;
            updateProgress(processedCount, data.length);
        }
    }

    function resetUI() {
        resultTableBody.innerHTML = '';
        studentData = {};
        progressBar.style.width = '0%';
        progressText.textContent = '';
    }

    function updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${current} / ${total} 개 생성 완료`;
    }

    function addResultRow(studentId, content) {
        const row = document.createElement('tr');
        row.id = `row-${studentId}`;
        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">${studentId}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                <select class="level-select p-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500" data-id="${studentId}">
                    <option value="상">상</option>
                    <option value="중상">중상</option>
                    <option value="중" selected>중</option>
                    <option value="중하">중하</option>
                    <option value="하">하</option>
                </select>
            </td>
            <td class="px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                <div class="content-display">${content}</div>
                <textarea class="content-edit hidden w-full p-1 border rounded-md resize-none overflow-hidden"></textarea>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium align-middle">
                <div class="flex items-center space-x-3">
                    <button class="edit-btn text-pink-500 hover:text-pink-700" data-id="${studentId}"><i class="fas fa-pencil-alt text-xl"></i></button>
                    <button class="save-btn text-emerald-500 hover:text-emerald-700 hidden" data-id="${studentId}"><i class="fas fa-check text-xl"></i></button>
                    <button class="details-btn text-violet-500 hover:text-violet-700" data-id="${studentId}"><i class="fas fa-search-plus text-xl"></i></button>
                    <button class="delete-btn text-red-500 hover:text-red-700" data-id="${studentId}"><i class="fas fa-trash-alt text-xl"></i></button>
                </div>
            </td>
        `;
        resultTableBody.appendChild(row);

        const textarea = row.querySelector('.content-edit');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });

        row.querySelector('.level-select').addEventListener('change', handleLevelChange);
        row.querySelector('.edit-btn').addEventListener('click', handleEditClick);
        row.querySelector('.save-btn').addEventListener('click', handleSaveClick);
        row.querySelector('.details-btn').addEventListener('click', handleDetailsClick);
        row.querySelector('.delete-btn').addEventListener('click', handleDeleteClick);
    }

    function addErrorRow(studentId, errorMessage) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-red-600">${studentId}</td>
            <td class="px-4 py-3 text-sm text-red-600" colspan="3">${errorMessage}</td>
        `;
        resultTableBody.appendChild(row);
    }

    async function handleLevelChange(event) {
        const studentId = event.target.dataset.id;
        const newLevel = event.target.value;
        const row = document.getElementById(`row-${studentId}`);
        const contentDisplay = row.querySelector('.content-display');

        contentDisplay.innerHTML = `<div class="flex justify-center items-center"><div class="spinner h-5 w-5 rounded-full border-4 border-slate-200"></div></div>`;

        try {
            const newContent = await callGenerativeAPI(studentData[studentId].originalContent, newLevel);
            studentData[studentId].content = newContent.trim();
            contentDisplay.textContent = newContent.trim();
            const textarea = row.querySelector('.content-edit');
            textarea.value = newContent.trim();
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        } catch (error) {
            console.error('Error regenerating content:', error);
            contentDisplay.textContent = '내용을 다시 생성하는 중 오류가 발생했습니다.';
            contentDisplay.classList.add('text-red-500');
        }
    }

    function handleEditClick(event) {
        const studentId = event.currentTarget.dataset.id;
        const row = document.getElementById(`row-${studentId}`);
        const display = row.querySelector('.content-display');
        const edit = row.querySelector('.content-edit');

        edit.value = display.textContent;
        display.classList.add('hidden');
        edit.classList.remove('hidden');
        row.querySelector('.edit-btn').classList.add('hidden');
        row.querySelector('.save-btn').classList.remove('hidden');

        edit.style.height = 'auto';
        edit.style.height = `${edit.scrollHeight}px`;
        edit.focus();
    }

    function handleSaveClick(event) {
        const studentId = event.currentTarget.dataset.id;
        const row = document.getElementById(`row-${studentId}`);
        const newContent = row.querySelector('.content-edit').value.trim();

        studentData[studentId].content = newContent;
        row.querySelector('.content-display').textContent = newContent;

        row.querySelector('.content-display').classList.remove('hidden');
        row.querySelector('.content-edit').classList.add('hidden');
        row.querySelector('.edit-btn').classList.remove('hidden');
        row.querySelector('.save-btn').classList.add('hidden');
    }

    async function handleDetailsClick(event) {
        const studentId = event.currentTarget.dataset.id;
        document.getElementById('modal-student-id').textContent = studentId;

        const aiReasoningEl = document.getElementById('modal-ai-reasoning');
        const originalContentEl = document.getElementById('modal-original-content');

        originalContentEl.textContent = studentData[studentId].originalContent;

        if (studentData[studentId].reasoning) {
            aiReasoningEl.textContent = studentData[studentId].reasoning;
        } else {
            aiReasoningEl.innerHTML = `<div class="flex justify-center items-center"><div class="spinner h-5 w-5 rounded-full border-4 border-slate-200"></div></div>`;
            try {
                const reasoningPrompt = `
                    아래의 '원본 학생 활동 내용'을 바탕으로 생성된 '특기사항 결과'가 어떤 근거로 작성되었는지 설명해주세요.
                    - 원본 내용의 어떤 구절이나 키워드를 참조했는지 구체적으로 언급해주세요.
                    - 분석적이고 전문적인 톤으로 설명해주세요.
                    
                    ---
                    [원본 학생 활동 내용]
                    ${studentData[studentId].originalContent}
                    
                    ---
                    [특기사항 결과]
                    ${studentData[studentId].content}
                    ---
                `;
                const reasoning = await callGenerativeAPI(reasoningPrompt, '중', true);
                studentData[studentId].reasoning = reasoning;
                aiReasoningEl.textContent = reasoning;
            } catch (error) {
                aiReasoningEl.textContent = '근거를 생성하는 중 오류가 발생했습니다.';
                aiReasoningEl.classList.add('text-red-500');
            }
        }

        detailsModal.classList.remove('hidden');
    }

    async function callGenerativeAPI(fileContent, level, isReasoning = false) {
        const prompt = isReasoning ? fileContent : buildPrompt(fileContent, level);

        try {
            const response = await fetch('/.netlify/functions/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'API 요청에 실패했습니다.');
            }

            const data = await response.json();
            return data.result ? data.result.trim() : '결과를 생성하지 못했습니다.';

        } catch (error) {
            console.error("API Call Error:", error);
            throw error;
        }
    }

    function buildPrompt(fileContent, level) {
        const recordType = document.getElementById('record-type').value;
        const subject = document.getElementById('subject').value;
        const curriculumInfo = document.getElementById('curriculum-info').value;
        const classActivityInfo = document.getElementById('class-activity-info').value;
        const guidelines = document.getElementById('guidelines').value;
        let startPhrase = document.getElementById('start-phrase').value.trim();

        const recordDefinitions = {
            '교과세특': '학생참여형 수업 및 수업과 연계된 수행평가 등에서 관찰한 내용을 입력함.',
            '자율활동': '임원 활동, 학교 행사 참여, 학교 프로그램 이수 등 학교생활 충실도를 평가합니다.',
            '동아리활동': '자율동아리는 반영되지 않으며, 정규 창체 동아리에서의 활동 내용, 역할, 고민 등을 구체적으로 기록합니다.',
            '진로활동': '희망 분야 관련 보고서, 직업 체험, 전문가 초청 프로그램 참여 경험 등을 기록하며, 학습 내용을 현재 관심사와 연결하려는 노력이 중요합니다.',
            '행동발달특성': '학생의 전반적인 인성, 자기주도성, 학교생활에서의 태도 변화, 성장 과정 등을 종합적으로 평가하여 기록합니다.'
        };
        const recordDefinition = recordDefinitions[recordType];

        let levelInstruction = '';
        switch (level) {
            case '상':
            case '중상':
                levelInstruction = '학생의 역량과 활동의 우수성이 잘 드러나 보도록 매우 구체적인 사례와 함께 깊이 있게 서술해주세요. 분량은 400자에서 500자 내외로 작성해주세요.';
                break;
            case '중':
                levelInstruction = '활동에 대한 사실을 객관적으로 기록하고, 그에 대한 사실적인 평가가 드러나도록 서술해주세요. 분량은 200자에서 300자 내외로 작성해주세요.';
                break;
            case '하':
            case '중하':
                levelInstruction = '활동에 참여했다다는 사실을 중심으로 단순하고 간결하게 기록해주세요. 분량은 100자에서 200자 내외로 작성해주세요.';
                break;
        }

        return `
            # 지시사항: 학생 활동 기록문을 바탕으로 지정된 조건에 맞춰 특기사항을 작성해주세요.

            ## 1. 작성 맥락
            - 특기사항 종류: ${recordType}
            - 영역 정의: ${recordDefinition}
            ${recordType === '교과세특' ? `- 과목: ${subject}` : ''}
            - 관련 교육과정: ${curriculumInfo || '미지정'}
            - 수업(활동) 내용: ${classActivityInfo || '미지정'}

            ## 2. 생성 조건
            - 학생 수행 수준: ${level} (${levelInstruction})
            - 사용자 추가 지침: ${guidelines || '없음'}

            ## 3. 출력 형식 및 스타일 가이드
            - **시작 문구:** "${startPhrase}" (만약 시작 문구가 있다면 반드시 이 문구로 시작해주세요. 없다면 자율적으로 시작해주세요.)
            - **결과물 형식:** 최종 결과물에는 수행 수준('상', '중', '하' 등), 넘버링, 제목, 구분선 등 어떤 부가 정보도 포함하지 마세요. 오직 특기사항 내용 본문만 출력해야 합니다.
            - **어조 및 문체:** 품격 있고 신뢰감을 주는 전문가적 어조를 사용하세요.
            - **문장 종결 어미:** 모든 문장은 '~임.', '~음.', '~함.'으로 끝내주세요.
            - **금지 단어:** '학생', '그는', '그가', '그의'와 같은 3인칭 대명사를 사용하지 마세요.
            - **긍정적 서술:** 제출된 활동 내용에서 긍정적인 역량을 부각하여 구체적으로 서술해주세요.
            - **부정적 서술 변환:** 만약 부정적인 키워드가 있다면, 그대로 사용하지 말고 긍정적 성장 가능성으로 변환하여 서술해주세요. (예: '인내심 부족' -> '꾸준한 자기 성찰을 통해 더 많은 여유를 갖춘다면 크게 성장할 것으로 기대됨.')
            - **언어:** 모든 영어는 한국어로 번역해주세요.
            - **줄바꿈:** 문단 전체는 줄바꿈 없이 한 줄로 이어지게 작성해주세요.

            ## 4. 참고 예시 및 키워드
            - **예시1:** 문학작품 감상 기반 통합적 적용 탐구활동으로 도파민 추구 현상에 관심을 갖고 '트렌드 코리아 2024(김난도 외)'에서 관련 부분을 찾아 읽고 도파민 추구 현상을 적절하게 활용한다면 지루하다고 여기는 과업들을 수행할 때 더 큰 성취감과 보상, 흥미를 느낄 수 있다는 가설을 세우고 보고서를 작성함.
            - **예시2:** '동물실험은 허용되어야 한다'라는 논제로 진행된 토론에서 찬성측 입장으로서 우수한 논리력과 설득력을 발휘함. 주제에 대한 깊이 있는 이해와 철저한 준비가 돋보였으며, 토론의 핵심 쟁점을 명확히 파악하고 논리적으로 정리함.
            - **활용 가능 키워드:** 탐구함, 성찰함, 능숙함, 생각이 깊음, 분석적 사고력, 자신있게 이야기함, 뛰어남, 탁월함, 발휘함, 인상적임, 분석함, 확장함, 추론함, 토론함, 우수함, 돋보임, 발표함, 설명함, 이끌어냄, 제시함, 다양한 배경지식, 논리적, 창의적, 비판적 사고, 인문학적 성찰, 논리정연.

            ---
            ## 5. 학생 활동 기록문 (이 내용을 바탕으로 작성):
            ${fileContent}
        `;
    }

    async function readFileContent(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        return new Promise((resolve, reject) => {
            if (extension === 'txt') {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            } else if (extension === 'pdf') {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const pdf = await pdfjsLib.getDocument({
                            data: e.target.result
                        }).promise;
                        let text = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            text += content.items.map(item => item.str).join(' ');
                        }
                        resolve(text);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            } else if (extension === 'docx') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    docx.renderAsync(e.target.result, document.createElement('div'))
                        .then(x => {
                            resolve(x.innerText || '');
                        })
                        .catch(reject);
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            } else {
                resolve(`지원하지 않는 파일 형식입니다: .${extension}`);
            }
        });
    }

    function copyResultsToClipboard() {
        let textToCopy = '';
        const rows = resultTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const studentIdCell = row.cells[0];
            if (!studentIdCell) return;
            
            const studentId = studentIdCell.textContent;
            if (studentData[studentId]) {
                 const content = studentData[studentId].content || row.querySelector('.content-display').textContent;
                 textToCopy += `${studentId}\t${content}\n`;
            }
        });

        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('결과가 클립보드에 복사되었습니다.');
        } catch (err) {
            alert('클립보드 복사에 실패했습니다.');
        }
        document.body.removeChild(textarea);
    }

    function saveFormData() {
        const formData = {
            curriculumInfo: document.getElementById('curriculum-info').value,
            classActivityInfo: document.getElementById('class-activity-info').value,
            recordType: document.getElementById('record-type').value,
            subject: document.getElementById('subject').value,
            guidelines: document.getElementById('guidelines').value,
            startPhrase: document.getElementById('start-phrase').value,
        };
        localStorage.setItem('formData', JSON.stringify(formData));
    }

    function loadFormData() {
        const savedData = localStorage.getItem('formData');
        if (savedData) {
            const data = JSON.parse(savedData);
            document.getElementById('curriculum-info').value = data.curriculumInfo || '';
            document.getElementById('class-activity-info').value = data.classActivityInfo || '';
            document.getElementById('record-type').value = data.recordType || '교과세특';
            document.getElementById('subject').value = data.subject || '국어';
            document.getElementById('guidelines').value = data.guidelines || '';
            document.getElementById('start-phrase').value = data.startPhrase || '';
        }
        toggleSubjectVisibility(); // Initial check
    }
});
