# 🔐 Development Authentication Setup

This document explains the mock authentication system implemented for development and testing purposes.

## 🎯 Overview

We've implemented a development authentication system that provides:

1. **Mock Login UI** in the main menu
2. **Session Management** with localStorage
3. **Login Gating** for score submissions
4. **Backward Compatibility** with existing authentication system
5. **Easy Migration Path** to Privy + Monad Games ID

## 🎮 How It Works

### **Main Menu Login**
- New "Login with Monad Games ID" button appears below other menu buttons
- Click to login with a simple username prompt (dev mode)
- Session is saved to localStorage and persists across game sessions
- Logout button appears when logged in

### **Session Management**
- Sessions stored in `localStorage` with key `mk_session`
- Contains: `userId`, `username`, `walletAddress`, `loginTime`, `provider`
- Cross-component communication via `mk-session-changed` events

### **Score Submission Gating**
- Players must be logged in to submit scores
- Alert shown if attempting to submit without login
- Session data included in API calls for server validation

## 📁 New Files Added

### `/api/auth/mock.js`
Mock authentication endpoint that generates fake session data:
```javascript
// POST /api/auth/mock
// Body: { username: "PlayerName" }
// Returns: { ok: true, session: {...} }
```

### `/session.js`
Client-side session management utilities:
- `saveSession(sess)` - Save session to localStorage
- `loadSession()` - Load session from localStorage  
- `clearSession()` - Remove session from localStorage
- `isLoggedIn()` - Check if user is logged in
- `mockLogin(username)` - Perform mock login
- `mockLogout()` - Perform logout

### Updated Files
- `MainMenuScene.js` - Added login UI and session management
- `contract.js` - Added login gating for score submission
- `game.js` - Updated to use session data for player identity
- `api/submit-score.js` - Added session validation logging

## 🔄 Migration to Real Authentication

When ready to implement Privy + Monad Games ID:

### **Step 1: Replace Mock API**
```javascript
// Replace /api/auth/mock.js with /api/auth/monadid.js
export default async function handler(req, res) {
  // 1. Verify Privy signature/token
  // 2. Fetch user data from Monad Games ID
  // 3. Generate JWT token
  // 4. Return session with real wallet address
}
```

### **Step 2: Update Login UI**
```javascript
// Replace prompt with Privy SDK flow
this.loginText.on('pointerup', async () => {
  try {
    await privy.login(); // Opens Privy modal
    const user = privy.getUser();
    // Handle successful authentication
  } catch (error) {
    // Handle login error
  }
});
```

### **Step 3: Add JWT Validation**
```javascript
// Update /api/submit-score.js
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// Validate user and proceed with blockchain submission
```

## 🧪 Testing the Dev System

### **Test Login Flow**
1. Start the game and go to main menu
2. Click "Login with Monad Games ID"
3. Enter any username in the prompt
4. Verify login status shows "Logged in as [username]"
5. Check browser console for session logs

### **Test Score Submission**
1. Login as described above
2. Play the game and defeat the boss
3. Check console for "Score successfully submitted" message
4. Verify session data is included in API call

### **Test Session Persistence**
1. Login and verify logged in status
2. Refresh the page/restart the game
3. Return to main menu - should still show logged in
4. Click logout to clear session

## 🔍 Debugging

### **Check Session Data**
```javascript
// In browser console
console.log(localStorage.getItem('mk_session'));
```

### **Monitor Session Events**
```javascript
// In browser console
window.addEventListener('mk-session-changed', (e) => {
  console.log('Session changed:', e.detail);
});
```

### **Clear Session Manually**
```javascript
// In browser console
localStorage.removeItem('mk_session');
```

## 🎯 Benefits of This Approach

1. **Immediate Testing** - Login flow works right now
2. **Real User Experience** - Players can see the complete flow
3. **Backend Integration** - Score submission includes session data
4. **Easy Migration** - Clear path to replace with real authentication
5. **Backward Compatibility** - Works with existing game systems

The mock system provides the exact same user experience as the final implementation, just with fake credentials. This allows full testing of the game flow while the real Privy integration is being set up! 🚀