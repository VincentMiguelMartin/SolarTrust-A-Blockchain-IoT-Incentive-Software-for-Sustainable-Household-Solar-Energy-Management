package com.example.cst.utils

import android.content.Context

class SessionManager(context: Context) {

    private val prefs =
        context.getSharedPreferences("session", Context.MODE_PRIVATE)

    fun saveLogin(userId: Int) {
        prefs.edit().putInt("USER_ID", userId).apply()
    }

    fun isLoggedIn(): Boolean {
        return prefs.contains("USER_ID")
    }

    fun logout() {
        prefs.edit().clear().apply()
    }
}
