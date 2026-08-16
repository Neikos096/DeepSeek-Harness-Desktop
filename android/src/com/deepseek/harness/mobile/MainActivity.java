package com.deepseek.harness.mobile;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String PREFS = "dsh_mobile";
    private static final String KEY_URL = "server_url";

    private FrameLayout root;
    private WebView webView;
    private LinearLayout setupView;
    private Button settingsBtn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0b1320"));

        webView = new WebView(this);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.setWebViewClient(new WebViewClient());
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        settingsBtn = new Button(this);
        settingsBtn.setText("设置");
        settingsBtn.setTextSize(13);
        settingsBtn.setAlpha(0.9f);
        settingsBtn.setOnClickListener(v -> showSetup());
        FrameLayout.LayoutParams btnLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        btnLp.gravity = Gravity.TOP | Gravity.END;
        btnLp.setMargins(0, dp(20), dp(16), 0);

        root.addView(webView);
        root.addView(settingsBtn, btnLp);

        setupView = buildSetupView();
        root.addView(setupView);
        setContentView(root);

        String saved = prefs().getString(KEY_URL, "");
        if (!saved.isEmpty()) {
            showWeb(saved);
        } else {
            showSetup();
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(android.content.Intent intent) {
        if (intent == null) return;
        String url = intent.getStringExtra("url");
        if (url != null && !url.trim().isEmpty()) {
            String full = url.trim();
            if (!full.startsWith("http://") && !full.startsWith("https://")) {
                full = "http://" + full;
            }
            prefs().edit().putString(KEY_URL, full).apply();
            if (webView != null && setupView != null) showWeb(full);
        }
    }

    private LinearLayout buildSetupView() {
        LinearLayout ll = new LinearLayout(this);
        ll.setOrientation(LinearLayout.VERTICAL);
        ll.setPadding(dp(24), dp(56), dp(24), dp(24));
        ll.setBackgroundColor(Color.parseColor("#0b1320"));

        TextView title = new TextView(this);
        title.setText("连接 DeepSeek Harness");
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);

        TextView tip = new TextView(this);
        tip.setText("输入电脑端托盘菜单里显示的访问地址(例如 http://192.168.1.5:3088),然后点击连接。首次连接会在页面中要求输入访问口令。");
        tip.setTextSize(13);
        tip.setTextColor(Color.parseColor("#93a7c4"));
        tip.setLineSpacing(0, 1.35f);

        EditText urlInput = new EditText(this);
        urlInput.setHint("http://192.168.1.5:3088");
        urlInput.setSingleLine(true);
        urlInput.setTextSize(15);
        urlInput.setTextColor(Color.WHITE);
        urlInput.setHintTextColor(Color.parseColor("#5b6f8e"));
        urlInput.setText(prefs().getString(KEY_URL, ""));

        Button connect = new Button(this);
        connect.setText("连接");
        connect.setTextSize(16);
        connect.setAllCaps(false);
        connect.setOnClickListener(v -> {
            String url = urlInput.getText().toString().trim();
            if (url.isEmpty()) {
                Toast.makeText(this, "请输入电脑端访问地址", Toast.LENGTH_SHORT).show();
                return;
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://" + url;
            }
            prefs().edit().putString(KEY_URL, url).apply();
            showWeb(url);
        });

        Button local = new Button(this);
        local.setText("本机模式 (127.0.0.1:3080)");
        local.setTextSize(14);
        local.setAllCaps(false);
        local.setAlpha(0.9f);
        local.setOnClickListener(v -> {
            prefs().edit().putString(KEY_URL, "http://127.0.0.1:3080").apply();
            showWeb("http://127.0.0.1:3080");
        });

        ll.addView(title, lp(0));
        ll.addView(tip, lp(dp(10)));
        ll.addView(urlInput, lp(dp(18)));
        ll.addView(connect, lp(dp(18)));
        ll.addView(local, lp(dp(8)));
        return ll;
    }

    private void showSetup() {
        setupView.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
    }

    private void showWeb(String url) {
        setupView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private int dp(int v) {
        return Math.round(getResources().getDisplayMetrics().density * v);
    }

    private LinearLayout.LayoutParams lp(int topMargin) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(0, topMargin, 0, 0);
        return p;
    }
}
