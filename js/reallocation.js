(function () {
    'use strict';

    /**
     * SCAD College Attendance ERP - Period Reallocation Module
     * Handles requesting, accepting, and declining period reallocations.
     */

    const REALLOCATION_STORAGE_KEY = 'scad_reallocations';

    function getRequests() {
        const data = localStorage.getItem(REALLOCATION_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    function saveRequests(requests) {
        localStorage.setItem(REALLOCATION_STORAGE_KEY, JSON.stringify(requests));
    }

    window.Reallocation = {
        
        /**
         * Create a new reallocation request
         */
        createRequest: function (fromFacultyId, toFacultyId, date, period, classGroup, reason) {
            const requests = getRequests();
            const newReq = {
                id: 'req_' + Date.now(),
                fromFacultyId,
                toFacultyId,
                date,
                period,
                classGroup,
                reason,
                status: 'pending', // 'pending', 'accepted', 'declined', 'expired'
                timestamp: Date.now()
            };
            requests.push(newReq);
            saveRequests(requests);
            return newReq;
        },

        /**
         * Get incoming pending requests for a specific faculty
         */
        getIncomingRequests: function (facultyId) {
            this.checkExpired();
            const requests = getRequests();
            return requests.filter(r => r.toFacultyId === facultyId && r.status === 'pending');
        },

        /**
         * Get outgoing requests created by a faculty (to see status updates)
         */
        getOutgoingRequests: function (facultyId) {
            this.checkExpired();
            const requests = getRequests();
            // Return only recently resolved or pending ones
            const recent = Date.now() - (24 * 60 * 60 * 1000); // last 24h
            return requests.filter(r => r.fromFacultyId === facultyId && r.timestamp > recent);
        },

        /**
         * Accept a request
         */
        acceptRequest: function (requestId) {
            const requests = getRequests();
            const req = requests.find(r => r.id === requestId);
            if (req && req.status === 'pending') {
                req.status = 'accepted';
                saveRequests(requests);
                return true;
            }
            return false;
        },

        /**
         * Decline a request
         */
        declineRequest: function (requestId) {
            const requests = getRequests();
            const req = requests.find(r => r.id === requestId);
            if (req && req.status === 'pending') {
                req.status = 'declined';
                saveRequests(requests);
                return true;
            }
            return false;
        },

        /**
         * Check and expire old pending requests (> 30 mins)
         */
        checkExpired: function () {
            const requests = getRequests();
            let changed = false;
            const now = Date.now();
            requests.forEach(r => {
                if (r.status === 'pending' && (now - r.timestamp > 30 * 60 * 1000)) {
                    r.status = 'expired';
                    changed = true;
                }
            });
            if (changed) {
                saveRequests(requests);
            }
        },

        /**
         * Helper: Check if a specific period has been reallocated TO this faculty
         */
        getReallocatedPeriodsForFaculty: function (facultyId, date) {
            const requests = getRequests();
            return requests.filter(r => r.toFacultyId === facultyId && r.date === date && r.status === 'accepted');
        },

        /**
         * Helper: Check if a specific period has been reallocated FROM this faculty
         */
        getReallocatedPeriodsFromFaculty: function (facultyId, date) {
            const requests = getRequests();
            return requests.filter(r => r.fromFacultyId === facultyId && r.date === date && r.status === 'accepted');
        }
    };

})();
