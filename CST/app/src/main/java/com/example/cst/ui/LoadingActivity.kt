package com.example.cst.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.example.cst.utils.SessionManager

class LoadingActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Handler(Looper.getMainLooper()).postDelayed({
            val session = SessionManager(this)
            val next = if (session.isLoggedIn())
                DashboardActivity::class.java
            else
                LoginActivity::class.java

            startActivity(Intent(this, next))
            finish()
        }, 2000)
    }
}
