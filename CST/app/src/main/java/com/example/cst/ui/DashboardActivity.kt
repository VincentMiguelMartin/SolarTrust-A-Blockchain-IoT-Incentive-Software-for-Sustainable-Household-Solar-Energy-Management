package com.example.cst.ui

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.cst.R
import com.example.cst.utils.SessionManager

class DashboardActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        findViewById<TextView>(R.id.tvSolar).text =
            "Solar Power: ${(500..2000).random()} W"

        findViewById<TextView>(R.id.tvGrid).text =
            "Grid Power: ${(500..2000).random()} W"

        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            SessionManager(this).logout()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }
}
