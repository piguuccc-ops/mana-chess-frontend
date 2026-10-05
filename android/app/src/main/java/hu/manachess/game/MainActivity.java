package hu.manachess.game;

// ─────────────────────────────────────────────────────────────────────────────
// Mana Chess for Android: the same game as the web page, packed into the app (it works without a
// network – against the bots, or two players on one phone) in a full-screen WebView.
//
//  • The game is served from the APK's assets at https://appassets.androidplatform.net/ (a
//    proper web origin: the decks and settings are kept like in a browser).
//  • Online play talks to the backend the player types in – plain http on a home network is
//    allowed (a LAN server has no certificate), https through Nginx Proxy Manager as well.
//  • The page reaches the phone through window.ManaAndroid: short vibrations, keeping the
//    screen on during a game, opening links in the browser. The back button asks the page
//    first (closing a card, a dialog, leaving a game) – see src/ui/native.ts.
//  • Full screen (the bars come back with a swipe), the notch is respected, the keyboard pushes
//    the page up instead of covering the field being typed into.
// ─────────────────────────────────────────────────────────────────────────────

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.DisplayCutout;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    /** The origin the bundled game is served from (never leaves the phone). */
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    private static final int BACKGROUND = 0xFF120C0A;

    private WebView web;
    private FrameLayout root;
    /** Android < 11: how much of the window the keyboard covers (see watchKeyboard). */
    private int keyboard = 0;
    private Rect cutout = new Rect();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 28) {
            // draw under the notch too (a phone on its side); the page keeps clear of it (insets)
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
        root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        web = new WebView(this);
        web.setBackgroundColor(BACKGROUND);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        watchInsets();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100); // the system font size must not break the pixel layout
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        // a server on the home network speaks plain http – allowed from the app's own page
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " ManaChessApp/" + versionName());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(new Bridge(), "ManaAndroid");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null; // the backend and anything else: the network
                return asset(u.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openOutside(u.toString()); // other pages open in the phone's browser
                return true;
            }
        });
        web.loadUrl(START);
        immersive();
    }

    // ── the bundled game ─────────────────────────────────────────────────────

    private WebResourceResponse asset(String path) {
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        String name = "www" + path;
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Cache-Control", "no-cache");
        if (name.contains("..")) return missing(headers);
        try {
            InputStream in = getAssets().open(name);
            String type = mime(name);
            boolean text = type.startsWith("text/") || type.endsWith("javascript") || type.endsWith("json");
            return new WebResourceResponse(type, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return missing(headers);
        }
    }

    private static WebResourceResponse missing(Map<String, String> headers) {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".js") || n.endsWith(".mjs")) return "application/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    // ── full screen, the notch, the keyboard ─────────────────────────────────

    @SuppressWarnings("deprecation")
    private void immersive() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }

    /** The page keeps clear of the notch, and of the keyboard while one is open. */
    private void watchInsets() {
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                cutout.setEmpty();
                if (Build.VERSION.SDK_INT >= 28) {
                    DisplayCutout c = insets.getDisplayCutout();
                    if (c != null) cutout.set(c.getSafeInsetLeft(), c.getSafeInsetTop(), c.getSafeInsetRight(), c.getSafeInsetBottom());
                }
                if (Build.VERSION.SDK_INT >= 30) keyboard = insets.getInsets(WindowInsets.Type.ime()).bottom;
                pad();
                return insets;
            }
        });
        if (Build.VERSION.SDK_INT < 30) {
            // full screen ignores adjustResize on older Androids: measure what is still visible
            root.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
                @Override
                public void onGlobalLayout() {
                    Rect r = new Rect();
                    root.getWindowVisibleDisplayFrame(r);
                    int full = root.getRootView().getHeight();
                    int covered = full - r.bottom;
                    int k = covered > full / 5 ? covered : 0; // more than a fifth: that is a keyboard
                    if (k != keyboard) {
                        keyboard = k;
                        pad();
                    }
                }
            });
        }
    }

    private void pad() {
        root.setPadding(cutout.left, cutout.top, cutout.right, Math.max(cutout.bottom, keyboard));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    // ── the back button: the page decides (a card closes, a game asks first…) ──

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return !!(window.__manaBack&&window.__manaBack())}catch(e){return false}})()", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) moveTaskToBack(true); // the main menu: to the background, the game stays as it was
            }
        });
    }

    // ── the page's helpers on the phone ──────────────────────────────────────

    final class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            buzz(new long[] { 0, Math.max(1, Math.min(ms, 1000)) });
        }

        /** "60,60,120": buzz, pause, buzz… */
        @JavascriptInterface
        public void vibratePattern(String pattern) {
            String[] parts = pattern == null ? new String[0] : pattern.split(",");
            if (parts.length == 0 || parts.length > 16) return;
            long[] t = new long[parts.length + 1];
            try {
                for (int i = 0; i < parts.length; i++) t[i + 1] = Math.max(0, Math.min(Long.parseLong(parts[i].trim()), 1000));
            } catch (NumberFormatException e) {
                return;
            }
            buzz(t);
        }

        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public void openExternal(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    openOutside(url);
                }
            });
        }

        @JavascriptInterface
        public String appVersion() {
            return versionName();
        }
    }

    @SuppressWarnings("deprecation")
    private void buzz(long[] timings) {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(timings, -1));
        else v.vibrate(timings, -1);
    }

    private void openOutside(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) {
            // no browser on the phone: nothing to do
        }
    }

    private String versionName() {
        try {
            PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
            return p.versionName == null ? "" : p.versionName;
        } catch (Exception e) {
            return "";
        }
    }

    // ── the WebView follows the activity ─────────────────────────────────────

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause(); // the page is told it is hidden (the sounds stop); online games keep polling
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        immersive();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }
}
