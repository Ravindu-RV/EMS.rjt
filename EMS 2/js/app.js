// App Core Logic
const App = {
    async init() {
        Auth.requireAuth();
        this.setupEventHandlers(); // Must run unconditionally to bind login form
        const user = Auth.getCurrentUser();
        if (user) {
            this.loadDashboardData(user);
        }
    },

    setupEventHandlers() {
        document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
        
        // Setup Login Form
        document.getElementById('login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const success = await Auth.login(email, password);
            if (success) {
                Swal.fire({ icon: 'success', title: 'Logged In', timer: 1500, showConfirmButton: false });
                Auth.requireAuth();
                this.loadDashboardData(Auth.getCurrentUser());
            } else {
                Swal.fire({ icon: 'error', title: 'Login Failed', text: 'Invalid email or password' });
            }
        });

        // Setup File Upload limits (Base64 conversion)
        // General handler for file inputs can be added here if needed
    },

    async loadDashboardData(user) {
        // Load notifications
        this.renderNotifications(user.id);

        if (user.role === 'hod') {
            await this.renderHoDDashboard();
        } else if (user.role === 'ar') {
            await this.renderARDashboard();
        } else if (user.role === 'lec') {
            await this.renderLecturerDashboard(user.id);
        } else if (user.role === '2nd_ex') {
            await this.render2ndExDashboard(user.id);
        }
    },

    async renderNotifications(userId) {
        const notifs = await db.notifications.where('user_id').equals(userId).reverse().sortBy('timestamp');
        const container = document.getElementById('notifications-list');
        if(!container) return;
        
        container.innerHTML = notifs.length === 0 ? '<p class="text-sm text-gray-500 p-2">No notifications.</p>' : '';
        
        notifs.forEach(n => {
            const div = document.createElement('div');
            div.className = `p-3 border-b text-sm ${n.is_read ? 'bg-white' : 'bg-blue-50 font-semibold'}`;
            div.innerHTML = `
                <p>${n.message}</p>
                <span class="text-xs text-gray-400">${new Date(n.timestamp).toLocaleString()}</span>
            `;
            // Mark as read on click
            div.addEventListener('click', async () => {
                await db.notifications.update(n.id, { is_read: true });
                this.renderNotifications(userId);
            });
            container.appendChild(div);
        });
    },

    // Generates a random 6 digit OTP and stores in sessionStorage
    generateOTP() {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        sessionStorage.setItem('current_otp', otp);
        return otp;
    },

    // Utility to read file as Base64
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    },

    // ------------------------------------------------------------------------
    // HoD DASHBOARD
    // ------------------------------------------------------------------------
    async renderHoDDashboard() {
        const container = document.getElementById('hod-subjects-list');
        const subjects = await db.subjects.toArray();
        container.innerHTML = '';

        for (const sub of subjects) {
            const lec = await db.users.get(sub.lec_id);
            const ex2 = sub.second_ex_id ? await db.users.get(sub.second_ex_id) : { name: 'Not Assigned' };
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded shadow mb-4';
            div.innerHTML = `
                <h3 class="font-bold text-lg">${sub.name} (${sub.code})</h3>
                <p class="text-sm text-gray-600">Lecturer: ${lec.name} | 2nd Ex: ${ex2.name}</p>
                <p class="text-sm text-gray-600">Status: ${sub.is_board_approved ? 'Board Approved (Closed)' : (sub.is_eis_approved ? 'EIS Approved' : 'In Progress')}</p>
                <button class="mt-2 text-sm bg-blue-500 text-white px-3 py-1 rounded" onclick="App.viewSubjectDetails(${sub.id})">View Details & Timeline</button>
            `;
            container.appendChild(div);
        }
    },

    // ------------------------------------------------------------------------
    // AR DASHBOARD
    // ------------------------------------------------------------------------
    async renderARDashboard() {
        const container = document.getElementById('ar-action-list');
        const subjects = await db.subjects.toArray();
        container.innerHTML = '<h3 class="font-bold mb-2">Pending Actions</h3>';

        for (const sub of subjects) {
            const trackings = await db.trackings.where('subject_id').equals(sub.id).reverse().sortBy('timestamp');
            const currentStage = trackings.length > 0 ? trackings[0].current_stage : 'none';

            if (currentStage === 'none' && Date.now() > sub.exam_end_date) {
                // AR needs to receive physical bundle from Exam Hall
                const btn = document.createElement('button');
                btn.className = 'bg-green-500 text-white px-4 py-2 rounded m-1 text-sm';
                btn.innerText = `Receive Bundle for ${sub.code}`;
                btn.onclick = () => this.updateTracking(sub.id, 'received_by_ar', 'AR received physical bundle from exam hall');
                container.appendChild(btn);
            }
            else if (currentStage === 'received_by_ar') {
                const btn = document.createElement('button');
                btn.className = 'bg-blue-500 text-white px-4 py-2 rounded m-1 text-sm';
                btn.innerText = `Handover to Lecturer (${sub.code}) - Requires OTP`;
                btn.onclick = () => this.verifyOTPAndProceed(sub.id, 'collected_by_lec', 'Handed over to Lecturer');
                container.appendChild(btn);
            }
            else if (currentStage === 'submitted_marks_by_lec') {
                const btn = document.createElement('button');
                btn.className = 'bg-purple-500 text-white px-4 py-2 rounded m-1 text-sm';
                btn.innerText = `Receive Marked Bundle (${sub.code}) - Requires OTP`;
                btn.onclick = () => this.verifyOTPAndProceed(sub.id, 'received_marked_by_ar', 'AR received marked bundle from Lecturer');
                container.appendChild(btn);
            }
            else if (currentStage === 'received_marked_by_ar') {
                // Determine if 2nd Ex is internal or external
                db.users.get(sub.second_ex_id).then(ex2 => {
                    const btn = document.createElement('button');
                    if (ex2.role === 'lec') { // Internal
                        btn.className = 'bg-yellow-500 text-white px-4 py-2 rounded m-1 text-sm';
                        btn.innerText = `Handover to 2nd Ex (${sub.code}) - Internal (OTP)`;
                        btn.onclick = () => this.verifyOTPAndProceed(sub.id, 'collected_by_2nd_ex', 'Handed over to Internal 2nd Examiner');
                    } else { // External
                        btn.className = 'bg-orange-500 text-white px-4 py-2 rounded m-1 text-sm';
                        btn.innerText = `Courier to 2nd Ex (${sub.code}) - External`;
                        btn.onclick = () => this.showUploadCourierModal(sub.id, 'couriered_to_2nd_ex');
                    }
                    container.appendChild(btn);
                });
            }
            else if (currentStage === 'couriered_back_by_2nd_ex' || currentStage === 'report_uploaded_by_2nd_ex') {
                // If internal, they upload report and handover physically via OTP. If external, they upload report and courier receipt.
                // In both cases, AR must receive it back.
                const btn = document.createElement('button');
                btn.className = 'bg-indigo-500 text-white px-4 py-2 rounded m-1 text-sm';
                btn.innerText = `Receive 2nd Ex Report & Bundle (${sub.code}) - Requires OTP/Verification`;
                btn.onclick = () => this.verifyOTPAndProceed(sub.id, 'received_2nd_ex_bundle_by_ar', 'AR received bundle back from 2nd Examiner');
                container.appendChild(btn);
            }
            else if (currentStage === 'received_2nd_ex_bundle_by_ar') {
                const btn = document.createElement('button');
                btn.className = 'bg-teal-500 text-white px-4 py-2 rounded m-1 text-sm';
                btn.innerText = `Handover Final to Lecturer (${sub.code}) - Requires OTP`;
                btn.onclick = () => this.verifyOTPAndProceed(sub.id, 'final_collection_by_lec', 'Lecturer collected bundle for Final Corrections');
                container.appendChild(btn);
            }
        }
    },

    // ------------------------------------------------------------------------
    // LECTURER DASHBOARD
    // ------------------------------------------------------------------------
    async renderLecturerDashboard(userId) {
        const container = document.getElementById('lec-subjects-list');
        const subjects = await db.subjects.where('lec_id').equals(userId).toArray();
        container.innerHTML = '';

        for (const sub of subjects) {
            const trackings = await db.trackings.where('subject_id').equals(sub.id).reverse().sortBy('timestamp');
            const currentStage = trackings.length > 0 ? trackings[0].current_stage : 'none';

            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded shadow mb-4 border-l-4 border-blue-500';
            
            let actionHtml = '';

            // If subject has no 2nd examiner, allow selection
            if (!sub.second_ex_id) {
                actionHtml = `<button onclick="App.showSelect2ndExModal(${sub.id})" class="bg-indigo-500 text-white px-3 py-1 rounded">Select 2nd Examiner</button>`;
            } 
            else if (currentStage === 'received_by_ar') {
                actionHtml = `<button onclick="App.generateAndShowOTP()" class="bg-yellow-500 text-white px-3 py-1 rounded">Generate OTP to Collect Papers</button>`;
            }
            else if (currentStage === 'collected_by_lec' && !sub.is_eis_approved) {
                actionHtml = `<button onclick="App.showUploadMarksModal(${sub.id})" class="bg-purple-500 text-white px-3 py-1 rounded">Upload Detail Marks & Handover to AR</button>`;
            }
            else if (currentStage === 'received_2nd_ex_bundle_by_ar' && !sub.is_eis_approved) {
                actionHtml = `<button onclick="App.generateAndShowOTP()" class="bg-teal-500 text-white px-3 py-1 rounded">Generate OTP to Collect Final Bundle</button>`;
            }
            else if ((currentStage === 'final_collection_by_lec' || currentStage === 'eis_rejected') && !sub.is_eis_approved) {
                actionHtml = `<button onclick="App.showUploadFinalMarksModal(${sub.id})" class="bg-red-500 text-white px-3 py-1 rounded">Upload Final Mark Sheet & Update EIS</button>`;
            }
            else if (sub.is_eis_approved) {
                actionHtml = `<p class="text-green-600 font-bold text-sm">Subject Locked (EIS Approved)</p>`;
                // Allow payment claim if board approved
                if(sub.is_board_approved) {
                    actionHtml += `<button onclick="App.showUploadPaymentClaimModal(${sub.id})" class="bg-blue-600 text-white px-3 py-1 rounded mt-2 text-sm">Upload Payment Claim</button>`;
                }
            }

            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg">${sub.name} (${sub.code})</h3>
                        <p class="text-sm mb-2">Current Stage: <span class="font-semibold text-blue-600">${currentStage.replace(/_/g, ' ').toUpperCase()}</span></p>
                    </div>
                    <button class="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded" onclick="App.viewSubjectDetails(${sub.id})">Timeline</button>
                </div>
                ${actionHtml}
            `;
            container.appendChild(div);
        }
    },

    // ------------------------------------------------------------------------
    // 2ND EXAMINER DASHBOARD
    // ------------------------------------------------------------------------
    async render2ndExDashboard(userId) {
        const container = document.getElementById('2nd-ex-subjects-list');
        const subjects = await db.subjects.where('second_ex_id').equals(userId).toArray();
        container.innerHTML = '';

        for (const sub of subjects) {
            const trackings = await db.trackings.where('subject_id').equals(sub.id).reverse().sortBy('timestamp');
            const currentStage = trackings.length > 0 ? trackings[0].current_stage : 'none';
            const isInternal = user.role === 'lec';

            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded shadow mb-4 border-l-4 border-green-500';
            
            let actionHtml = '';

            if (currentStage === 'couriered_to_2nd_ex') {
                actionHtml = `<button onclick="App.updateTracking(${sub.id}, 'collected_by_2nd_ex', 'External 2nd Examiner received bundle')" class="bg-green-500 text-white px-3 py-1 rounded">Mark as Received</button>`;
            }
            else if (currentStage === 'received_marked_by_ar' && isInternal) {
                actionHtml = `<button onclick="App.generateAndShowOTP()" class="bg-yellow-500 text-white px-3 py-1 rounded">Generate OTP to Collect from AR</button>`;
            }
            else if (currentStage === 'collected_by_2nd_ex') {
                if(isInternal) {
                    actionHtml = `<button onclick="App.showUpload2ndExReportModal(${sub.id}, true)" class="bg-blue-500 text-white px-3 py-1 rounded">Upload Report & Return to AR (Internal)</button>`;
                } else {
                    actionHtml = `<button onclick="App.showUpload2ndExReportModal(${sub.id}, false)" class="bg-orange-500 text-white px-3 py-1 rounded">Upload Report & Courier Back</button>`;
                }
            }
            else if (sub.is_board_approved) {
                actionHtml = `<button onclick="App.showUploadPaymentClaimModal(${sub.id})" class="bg-blue-600 text-white px-3 py-1 rounded mt-2 text-sm">Upload Payment Claim</button>`;
            }

            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg">${sub.name} (${sub.code})</h3>
                        <p class="text-sm mb-2">Current Stage: <span class="font-semibold text-green-600">${currentStage.replace(/_/g, ' ').toUpperCase()}</span></p>
                    </div>
                    <button class="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded" onclick="App.viewSubjectDetails(${sub.id})">Timeline</button>
                </div>
                ${actionHtml}
            `;
            container.appendChild(div);
        }
    },

    // ------------------------------------------------------------------------
    // WORKFLOW ACTIONS
    // ------------------------------------------------------------------------
    
    async showSelect2ndExModal(subjectId) {
        // Fetch eligible 2nd examiners
        const allUsers = await db.users.where('role').anyOf(['lec', '2nd_ex']).toArray();
        const currentLec = Auth.getCurrentUser();
        
        let options = allUsers.map(u => {
            if (u.id !== currentLec.id && (u.role === '2nd_ex' || u.seniority_level > currentLec.seniority_level)) {
                return `<option value="${u.id}">${u.name} (${u.role === 'lec' ? 'Internal' : 'External'})</option>`;
            }
            return '';
        }).join('');

        const { value: selectedId } = await Swal.fire({
            title: 'Select 2nd Examiner',
            html: `<select id="swal-input1" class="swal2-input">${options}</select>`,
            focusConfirm: false,
            preConfirm: () => document.getElementById('swal-input1').value
        });

        if (selectedId) {
            // Rule 2: Max 4 subjects per 2nd examiner check
            const count = await db.subjects.where('second_ex_id').equals(parseInt(selectedId)).count();
            if (count >= 4) {
                return Swal.fire('Error', 'This examiner is already assigned to the maximum of 4 subjects.', 'error');
            }

            await db.subjects.update(subjectId, { second_ex_id: parseInt(selectedId) });
            await db.trackings.add({
                subject_id: subjectId,
                current_stage: '2nd_ex_assigned',
                status: 'completed',
                updated_by: currentLec.id,
                timestamp: Date.now()
            });
            Swal.fire('Assigned', '2nd Examiner assigned successfully.', 'success');
            this.loadDashboardData(currentLec);
        }
    },

    generateAndShowOTP() {
        const otp = this.generateOTP();
        Swal.fire('Your OTP', `<h1 class="text-4xl font-bold tracking-widest text-blue-600">${otp}</h1><p>Show this to the AR to collect/handover papers.</p>`, 'info');
    },

    async verifyOTPAndProceed(subjectId, nextStage, message) {
        const { value: enteredOTP } = await Swal.fire({
            title: 'Enter Counterparty OTP',
            input: 'text',
            inputPlaceholder: 'Enter 6 digit OTP'
        });

        if (enteredOTP && enteredOTP.length === 6) {
            await this.updateTracking(subjectId, nextStage, message);
            Swal.fire('Success', message, 'success');
        } else if (enteredOTP) {
            Swal.fire('Error', 'Invalid OTP Format', 'error');
        }
    },

    async updateTracking(subjectId, stage, message) {
        const user = Auth.getCurrentUser();
        await db.trackings.add({
            subject_id: subjectId,
            current_stage: stage,
            status: 'completed',
            updated_by: user.id,
            timestamp: Date.now()
        });
        
        // Notify HoD
        const hod = await db.users.where('role').equals('hod').first();
        if (hod) {
            await db.notifications.add({
                user_id: hod.id,
                message: `Subject ${subjectId}: ${message}`,
                is_read: false,
                timestamp: Date.now()
            });
        }
        
        this.loadDashboardData(user);
    },

    async showUploadMarksModal(subjectId) {
        const { value: file } = await Swal.fire({
            title: 'Upload Detail Marks Sheet (PDF)',
            input: 'file',
            inputAttributes: {
                'accept': 'application/pdf'
            }
        });

        if (file) {
            if (file.size > 5 * 1024 * 1024) return Swal.fire('Error', 'Max file size is 5MB.', 'error');
            
            const base64 = await this.readFileAsBase64(file);
            await db.files.add({
                subject_id: subjectId,
                file_type: 'detail_marks',
                uploaded_by: Auth.getCurrentUser().id,
                file_data: base64,
                timestamp: Date.now()
            });

            await this.updateTracking(subjectId, 'submitted_marks_by_lec', 'Lecturer uploaded Detail Marks');
            this.generateAndShowOTP(); // For physical handover to AR
            Swal.fire('Uploaded!', 'Now show the OTP to AR to handover the bundle physically.', 'success');
        }
    },

    async showUpload2ndExReportModal(subjectId, isInternal) {
        const { value: formValues } = await Swal.fire({
            title: isInternal ? 'Upload 2nd Examiner Report' : 'Upload Report & Courier Details',
            html:
                '<label class="block text-sm text-left">2nd Examiner Report (PDF)</label>' +
                '<input type="file" id="swal-file1" class="swal2-file" accept="application/pdf">' +
                (!isInternal ? '<label class="block text-sm text-left mt-2">Courier Tracking Number</label><input id="swal-track" class="swal2-input">' +
                '<label class="block text-sm text-left mt-2">Courier Receipt (Image/PDF)</label><input type="file" id="swal-file2" class="swal2-file" accept="image/*,application/pdf">' : ''),
            focusConfirm: false,
            preConfirm: () => {
                const reportFile = document.getElementById('swal-file1').files[0];
                if (!reportFile) {
                    Swal.showValidationMessage('Report file is required');
                    return false;
                }
                if (!isInternal) {
                    const track = document.getElementById('swal-track').value;
                    const receiptFile = document.getElementById('swal-file2').files[0];
                    if (!track || !receiptFile) {
                        Swal.showValidationMessage('Tracking details and receipt required');
                        return false;
                    }
                    return { reportFile, track, receiptFile };
                }
                return { reportFile };
            }
        });

        if (formValues) {
            const user = Auth.getCurrentUser();
            
            const reportBase64 = await this.readFileAsBase64(formValues.reportFile);
            await db.files.add({ subject_id: subjectId, file_type: '2nd_ex_report', uploaded_by: user.id, file_data: reportBase64, timestamp: Date.now() });

            if (!isInternal) {
                const receiptBase64 = await this.readFileAsBase64(formValues.receiptFile);
                await db.files.add({ subject_id: subjectId, file_type: 'return_courier_receipt', uploaded_by: user.id, file_data: receiptBase64, timestamp: Date.now() });
                await this.updateTracking(subjectId, 'couriered_back_by_2nd_ex', `Report uploaded & Couriered back. Tracking: ${formValues.track}`);
                Swal.fire('Success', 'Report and Courier Details uploaded successfully.', 'success');
            } else {
                await this.updateTracking(subjectId, 'report_uploaded_by_2nd_ex', 'Internal 2nd Ex uploaded report');
                this.generateAndShowOTP();
                Swal.fire('Uploaded!', 'Now show the OTP to AR to handover the bundle back physically.', 'success');
            }
        }
    },

    async showUploadFinalMarksModal(subjectId) {
        const { value: file } = await Swal.fire({
            title: 'Upload Final Mark Sheet (PDF)',
            text: 'I confirm that I have corrected the marks in the EIS as well.',
            input: 'file',
            inputAttributes: {
                'accept': 'application/pdf'
            }
        });

        if (file) {
            const base64 = await this.readFileAsBase64(file);
            await db.files.add({
                subject_id: subjectId,
                file_type: 'final_marks',
                uploaded_by: Auth.getCurrentUser().id,
                file_data: base64,
                timestamp: Date.now()
            });

            await this.updateTracking(subjectId, 'final_marks_uploaded', 'Lecturer uploaded Final Marks & Updated EIS');
            Swal.fire('Success', 'Final marks uploaded. Pending HoD approval.', 'success');
        }
    },

    async showUploadPaymentClaimModal(subjectId) {
         const { value: file } = await Swal.fire({
            title: 'Upload Payment Claim (PDF/IMG)',
            input: 'file',
            inputAttributes: {
                'accept': 'application/pdf,image/*'
            }
        });
        
        if (file) {
            const base64 = await this.readFileAsBase64(file);
            await db.files.add({
                subject_id: subjectId,
                file_type: 'payment_claim',
                uploaded_by: Auth.getCurrentUser().id,
                file_data: base64,
                timestamp: Date.now()
            });
            Swal.fire('Success', 'Payment claim uploaded.', 'success');
        }
    },

    async showUploadCourierModal(subjectId, nextStage) {
        const { value: formValues } = await Swal.fire({
            title: 'Courier Details',
            html:
                '<input id="swal-input1" class="swal2-input" placeholder="Tracking Number">' +
                '<input type="file" id="swal-input2" class="swal2-file" accept="image/*,application/pdf">',
            focusConfirm: false,
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').files[0]
                ]
            }
        });

        if (formValues && formValues[0] && formValues[1]) {
            const base64 = await this.readFileAsBase64(formValues[1]);
            await db.files.add({
                subject_id: subjectId,
                file_type: 'courier_receipt',
                uploaded_by: Auth.getCurrentUser().id,
                file_data: base64,
                timestamp: Date.now()
            });
            await this.updateTracking(subjectId, nextStage, `Couriered. Tracking No: ${formValues[0]}`);
            Swal.fire('Success', 'Courier details updated.', 'success');
        }
    },

    async viewSubjectDetails(subjectId) {
        const sub = await db.subjects.get(subjectId);
        const trackings = await db.trackings.where('subject_id').equals(subjectId).reverse().sortBy('timestamp');
        const files = await db.files.where('subject_id').equals(subjectId).toArray();
        const complaints = await db.complaints.where('subject_id').equals(subjectId).toArray();
        
        let timelineHtml = trackings.map((t, idx) => `
            <div class="mb-4 relative pl-6 border-l-2 ${idx === 0 ? 'border-blue-500' : 'border-gray-300'}">
                <div class="absolute w-3 h-3 bg-${idx === 0 ? 'blue' : 'gray'}-500 rounded-full -left-[7px] top-1"></div>
                <span class="text-xs text-gray-500">${new Date(t.timestamp).toLocaleString()}</span><br>
                <strong class="text-sm">${t.current_stage.replace(/_/g, ' ').toUpperCase()}</strong>
                ${t.status === 'delayed' ? '<span class="text-red-500 text-xs ml-2">Delayed</span>' : ''}
            </div>
        `).join('');

        let filesHtml = files.map(f => `<a href="${f.file_data}" download="${f.file_type}" class="text-blue-500 underline text-sm block">${f.file_type}</a>`).join('');
        let complaintsHtml = complaints.map(c => `<p class="text-red-500 text-sm">${c.reason}</p>`).join('');

        const isHoD = Auth.getCurrentUser().role === 'hod';
        let actionButtons = '';
        if (isHoD && !sub.is_eis_approved) {
            actionButtons = `
                <hr class="my-4">
                <button onclick="App.approveEIS(${sub.id})" class="bg-green-500 text-white px-3 py-1 rounded">Approve EIS</button>
                <button onclick="App.rejectEIS(${sub.id})" class="bg-red-500 text-white px-3 py-1 rounded">Reject Final Marks</button>
            `;
        } else if (isHoD && sub.is_eis_approved && !sub.is_board_approved) {
             actionButtons = `
                <hr class="my-4">
                <button onclick="App.approveBoard(${sub.id})" class="bg-blue-800 text-white px-3 py-1 rounded w-full">Final Exam Board Approve (Lock Subject)</button>
            `;
        }

        Swal.fire({
            title: `${sub.code} Details`,
            html: `
                <div class="text-left max-h-96 overflow-y-auto">
                    <h4 class="font-bold border-b pb-1 mb-2">Timeline</h4>
                    ${timelineHtml || '<p class="text-sm">No activity yet</p>'}
                    <h4 class="font-bold border-b pb-1 mt-4 mb-2">Files Attached</h4>
                    ${filesHtml || '<p class="text-sm">No files uploaded</p>'}
                    ${complaintsHtml.length > 0 ? `<h4 class="font-bold text-red-500 border-b pb-1 mt-4 mb-2">Complaints</h4>${complaintsHtml}` : ''}
                    ${actionButtons}
                </div>
            `,
            width: 600,
            showConfirmButton: false,
            showCloseButton: true
        });
    },

    async approveEIS(subjectId) {
        await db.subjects.update(subjectId, { is_eis_approved: true });
        await this.updateTracking(subjectId, 'eis_approved', 'HoD approved EIS and Final Marks');
        Swal.fire('Approved', 'Subject is now locked for Lecturers.', 'success');
        swal.close();
        this.loadDashboardData(Auth.getCurrentUser());
    },

    async rejectEIS(subjectId) {
        await this.updateTracking(subjectId, 'eis_rejected', 'HoD rejected Final Marks. Lecturer must re-upload.');
        Swal.fire('Rejected', 'Lecturer notified to re-check.', 'info');
        swal.close();
    },
    
    async approveBoard(subjectId) {
        await db.subjects.update(subjectId, { is_board_approved: true });
        await this.updateTracking(subjectId, 'board_approved', 'Final Board Approval complete. Closed.');
        Swal.fire('Closed', 'Subject is now completely locked.', 'success');
        swal.close();
        this.loadDashboardData(Auth.getCurrentUser());
    }
};

window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
