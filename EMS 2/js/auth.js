const Auth = {
    async login(email, password) {
        const hashedPw = hashPassword(password);
        const user = await db.users.where('email').equals(email).first();
        
        if (user && user.passwordHash === hashedPw) {
            // Remove password hash before saving to session storage
            delete user.passwordHash;
            sessionStorage.setItem('ems_user', JSON.stringify(user));
            return true;
        }
        return false;
    },

    logout() {
        sessionStorage.removeItem('ems_user');
        window.location.reload();
    },

    getCurrentUser() {
        const userJson = sessionStorage.getItem('ems_user');
        return userJson ? JSON.parse(userJson) : null;
    },

    requireAuth() {
        const user = this.getCurrentUser();
        if (!user) {
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('login-view').classList.add('flex');
            
            document.getElementById('app-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('flex');
        } else {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('login-view').classList.remove('flex');
            
            document.getElementById('app-view').classList.remove('hidden');
            document.getElementById('app-view').classList.add('flex');
            
            this.setupUIForRole(user);
            // Simulate cron job whenever an authenticated user loads the app
            checkDeadlines();
        }
    },

    setupUIForRole(user) {
        document.getElementById('user-name-display').textContent = user.name;
        document.getElementById('user-role-display').textContent = user.role.toUpperCase();

        // Hide all role-specific sections first
        document.querySelectorAll('.role-section').forEach(el => el.classList.add('hidden'));

        // Show based on role
        if (user.role === 'hod') {
            document.getElementById('hod-section').classList.remove('hidden');
        } else if (user.role === 'ar') {
            document.getElementById('ar-section').classList.remove('hidden');
        } else if (user.role === 'lec') {
            document.getElementById('lec-section').classList.remove('hidden');
        } else if (user.role === '2nd_ex') {
            document.getElementById('2nd-ex-section').classList.remove('hidden');
        }
    }
};
