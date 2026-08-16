package com.deepseek.harness.local;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String PREFS = "dsh_local";
    private static final String KEY_API = "api_key";
    private static final String KEY_TREE = "tree_uri";
    private static final int REQ_TREE = 100;
    private static final long MAX_READ = 2 * 1024 * 1024;
    private static final long MAX_READ_TOOL = 100 * 1024;

    private FrameLayout root;
    private LinearLayout setupView;
    private WebView web;
    private EditText apiInput;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0b1320"));

        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "dsh");

        setupView = buildSetupView();
        root.addView(web);
        root.addView(setupView);
        setContentView(root);

        if (prefs().getString(KEY_API, "").isEmpty()) {
            showSetup();
        } else {
            showWeb();
        }
    }

    private LinearLayout buildSetupView() {
        LinearLayout ll = new LinearLayout(this);
        ll.setOrientation(LinearLayout.VERTICAL);
        ll.setPadding(dp(24), dp(48), dp(24), dp(24));
        ll.setBackgroundColor(Color.parseColor("#0b1320"));

        TextView title = new TextView(this);
        title.setText("DSH 本地版");
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);

        TextView tip = new TextView(this);
        tip.setText("本地运行的 AI 文件助手:填 DeepSeek API Key,选择一个可操作的文件夹,就能让 AI 帮你读、写、建、删文件。所有请求只发给 DeepSeek,文件不离开手机。");
        tip.setTextSize(13);
        tip.setTextColor(Color.parseColor("#93a7c4"));
        tip.setLineSpacing(0, 1.35f);

        TextView apiLabel = new TextView(this);
        apiLabel.setText("DeepSeek API Key");
        apiLabel.setTextSize(13);
        apiLabel.setTextColor(Color.parseColor("#b8c7dd"));

        apiInput = new EditText(this);
        apiInput.setHint("sk-...");
        apiInput.setSingleLine(true);
        apiInput.setTextSize(15);
        apiInput.setTextColor(Color.WHITE);
        apiInput.setHintTextColor(Color.parseColor("#5b6f8e"));
        apiInput.setText(prefs().getString(KEY_API, ""));

        Button pick = new Button(this);
        pick.setText("选择工作文件夹(可选)");
        pick.setTextSize(14);
        pick.setAllCaps(false);
        pick.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(intent, REQ_TREE);
        });

        status = new TextView(this);
        status.setText("未选择文件夹(将使用应用私有目录)");
        status.setTextSize(12);
        status.setTextColor(Color.parseColor("#7d95b8"));

        Button start = new Button(this);
        start.setText("开始使用");
        start.setTextSize(16);
        start.setAllCaps(false);
        start.setOnClickListener(v -> {
            String key = apiInput.getText().toString().trim();
            if (key.isEmpty()) {
                Toast.makeText(this, "请先填写 DeepSeek API Key", Toast.LENGTH_SHORT).show();
                return;
            }
            prefs().edit().putString(KEY_API, key).apply();
            showWeb();
        });

        Button test = new Button(this);
        test.setText("Self-Test");
        test.setTextSize(13);
        test.setAllCaps(false);
        test.setAlpha(0.9f);
        test.setOnClickListener(v -> {
            status.setText("自检中...");
            new Thread(() -> {
                final String r = runSelfTest();
                runOnUiThread(() -> status.setText(r));
            }).start();
        });

        ll.addView(title, lp(0));
        ll.addView(tip, lp(dp(10)));
        ll.addView(apiLabel, lp(dp(18)));
        ll.addView(apiInput, lp(dp(6)));
        ll.addView(pick, lp(dp(14)));
        ll.addView(status, lp(dp(6)));
        ll.addView(start, lp(dp(14)));
        ll.addView(test, lp(dp(6)));
        return ll;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_TREE && resultCode == RESULT_OK && data != null && data.getData() != null) {
            Uri uri = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception ignored) { }
            prefs().edit().putString(KEY_TREE, uri.toString()).apply();
            String name = null;
            try {
                Uri docUri = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri));
                Cursor c = getContentResolver().query(docUri,
                        new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME }, null, null, null);
                if (c != null && c.moveToFirst()) name = c.getString(0);
                if (c != null) c.close();
            } catch (Exception ignored) { }
            status.setText("已选择文件夹: " + (name == null ? uri : name));
        }
    }

    private void showSetup() {
        setupView.setVisibility(View.VISIBLE);
        web.setVisibility(View.GONE);
    }

    private void showWeb() {
        setupView.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        web.loadUrl("file:///android_asset/chat.html");
    }

    @Override
    public void onBackPressed() {
        if (web.getVisibility() == View.VISIBLE && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
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

    // ------------------------------------------------------------------
    // 文件操作(SAF 树目录 / 应用私有目录 两种后端)
    // ------------------------------------------------------------------

    private String treeUri() {
        return prefs().getString(KEY_TREE, "");
    }

    private boolean hasTree() {
        return !treeUri().isEmpty();
    }

    private File privateRoot() {
        File dir = new File(getFilesDir(), "workspace");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private Uri treeRootUri() {
        Uri tree = Uri.parse(treeUri());
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    private static String[] splitPath(String rel) {
        String[] segs = rel == null ? new String[0] : rel.split("/");
        java.util.ArrayList<String> out = new java.util.ArrayList<>();
        for (String s : segs) {
            if (s.isEmpty() || s.equals(".")) continue;
            if (s.equals("..")) throw new IllegalArgumentException("路径不能包含 ..");
            out.add(s);
        }
        return out.toArray(new String[0]);
    }

    private JSONObject listFiles(String rel) {
        try {
            JSONArray arr = new JSONArray();
            if (hasTree()) {
                Uri dir = resolveTreeUri(rel, false);
                if (dir == null) return err("目录不存在: " + rel);
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(
                        Uri.parse(treeUri()), DocumentsContract.getDocumentId(dir));
                Cursor c = getContentResolver().query(children,
                        new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                                DocumentsContract.Document.COLUMN_MIME_TYPE,
                                DocumentsContract.Document.COLUMN_SIZE },
                        null, null, null);
                while (c != null && c.moveToNext()) {
                    String name = c.getString(0);
                    String mime = c.getString(1);
                    long size = c.getLong(2);
                    arr.put(new JSONObject().put("name", name)
                            .put("isDir", DocumentsContract.Document.MIME_TYPE_DIR.equals(mime))
                            .put("size", size));
                }
                if (c != null) c.close();
            } else {
                File dir = resolveFile(rel, false);
                if (dir == null) return err("目录不存在: " + rel);
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        arr.put(new JSONObject().put("name", f.getName()).put("isDir", f.isDirectory()).put("size", f.length()));
                    }
                }
            }
            return new JSONObject().put("ok", true).put("summary", "列出 " + arr.length() + " 项").put("items", arr);
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    private JSONObject readFile(String rel) {
        try {
            byte[] data;
            if (hasTree()) {
                Uri f = resolveTreeUri(rel, false);
                if (f == null) return err("文件不存在: " + rel);
                InputStream in = getContentResolver().openInputStream(f);
                data = readAll(in, MAX_READ);
            } else {
                File f = resolveFile(rel, false);
                if (f == null || f.isDirectory()) return err("文件不存在: " + rel);
                FileInputStream in = new FileInputStream(f);
                data = readAll(in, MAX_READ);
            }
            boolean truncated = data.length > MAX_READ_TOOL;
            String text = new String(data, 0, (int) Math.min(data.length, MAX_READ_TOOL), StandardCharsets.UTF_8);
            JSONObject out = new JSONObject().put("ok", true).put("content", text)
                    .put("summary", "已读取 " + rel + " (" + data.length + " 字节" + (truncated ? ",内容已截断" : "") + ")");
            return out;
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    private JSONObject writeFile(String rel, String content) {
        try {
            if (hasTree()) {
                Uri parent = resolveTreeUri(parentOf(rel), true);
                String name = nameOf(rel);
                Uri f = findTreeChild(parent, name);
                if (f == null) {
                    f = DocumentsContract.createDocument(getContentResolver(), parent, "application/octet-stream", name);
                }
                if (f == null) return err("无法创建文件: " + rel);
                OutputStream out = getContentResolver().openOutputStream(f);
                out.write(content == null ? new byte[0] : content.getBytes(StandardCharsets.UTF_8));
                out.close();
            } else {
                File f = new File(privateRoot(), rel);
                File p = f.getParentFile();
                if (p != null && !p.exists()) p.mkdirs();
                FileOutputStream out = new FileOutputStream(f);
                out.write(content == null ? new byte[0] : content.getBytes(StandardCharsets.UTF_8));
                out.close();
            }
            return new JSONObject().put("ok", true).put("summary", "已写入 " + rel);
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    private JSONObject mkdir(String rel) {
        try {
            if (hasTree()) {
                Uri parent = resolveTreeUri(parentOf(rel), true);
                String name = nameOf(rel);
                if (findTreeChild(parent, name) == null
                        && DocumentsContract.createDocument(getContentResolver(), parent,
                                DocumentsContract.Document.MIME_TYPE_DIR, name) == null) {
                    return err("无法创建目录: " + rel);
                }
            } else {
                File d = new File(privateRoot(), rel);
                if (!d.exists() && !d.mkdirs()) return err("无法创建目录: " + rel);
            }
            return new JSONObject().put("ok", true).put("summary", "已创建目录 " + rel);
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    private JSONObject deletePath(String rel, boolean isDir) {
        try {
            if (hasTree()) {
                Uri f = resolveTreeUri(rel, false);
                if (f == null) return err("不存在: " + rel);
                if (!DocumentsContract.deleteDocument(getContentResolver(), f)) return err("删除失败: " + rel);
            } else {
                File f = new File(privateRoot(), rel);
                if (!f.exists()) return err("不存在: " + rel);
                if (isDir) {
                    if (!deleteRecursive(f)) return err("删除失败: " + rel);
                } else {
                    if (!f.delete()) return err("删除失败: " + rel);
                }
            }
            return new JSONObject().put("ok", true).put("summary", "已删除 " + rel);
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    private boolean deleteRecursive(File f) {
        File[] children = f.listFiles();
        if (children != null) {
            for (File c : children) {
                if (!deleteRecursive(c)) return false;
            }
        }
        return f.delete();
    }

    private Uri resolveTreeUri(String rel, boolean createDirs) throws Exception {
        Uri cur = treeRootUri();
        for (String seg : splitPath(rel)) {
            Uri next = findTreeChild(cur, seg);
            if (next == null && createDirs) {
                next = DocumentsContract.createDocument(getContentResolver(), cur,
                        DocumentsContract.Document.MIME_TYPE_DIR, seg);
            }
            if (next == null) return null;
            cur = next;
        }
        return cur;
    }

    private Uri findTreeChild(Uri dir, String name) {
        try {
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(
                    Uri.parse(treeUri()), DocumentsContract.getDocumentId(dir));
            Cursor c = getContentResolver().query(children,
                    new String[] { DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                            DocumentsContract.Document.COLUMN_DISPLAY_NAME },
                    null, null, null);
            while (c != null && c.moveToNext()) {
                if (name.equals(c.getString(1))) {
                    String id = c.getString(0);
                    if (c != null) c.close();
                    return DocumentsContract.buildDocumentUriUsingTree(Uri.parse(treeUri()), id);
                }
            }
            if (c != null) c.close();
        } catch (Exception ignored) { }
        return null;
    }

    private File resolveFile(String rel, boolean createDirs) {
        File cur = privateRoot();
        for (String seg : splitPath(rel)) {
            File next = new File(cur, seg);
            if (!next.exists() && createDirs) next.mkdirs();
            if (!next.exists()) return null;
            cur = next;
        }
        return cur;
    }

    private static String parentOf(String rel) {
        int i = rel.lastIndexOf('/');
        return i < 0 ? "" : rel.substring(0, i);
    }

    private static String nameOf(String rel) {
        int i = rel.lastIndexOf('/');
        return i < 0 ? rel : rel.substring(i + 1);
    }

    private static byte[] readAll(InputStream in, long cap) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        long total = 0;
        int n;
        while ((n = in.read(buf)) != -1) {
            total += n;
            if (total > cap) {
                bos.write(buf, 0, n);
                break;
            }
            bos.write(buf, 0, n);
        }
        in.close();
        return bos.toByteArray();
    }

    private static JSONObject err(String msg) {
        try {
            return new JSONObject().put("ok", false).put("error", msg == null ? "未知错误" : msg);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private String runSelfTest() {
        try {
            JSONObject w = writeFile("selftest.txt", "hello from DSH local");
            if (!w.optBoolean("ok")) return "自检失败: " + w.optString("error");
            JSONObject r = readFile("selftest.txt");
            if (!r.optBoolean("ok")) return "自检失败: " + r.optString("error");
            JSONObject l = listFiles("");
            deletePath("selftest.txt", false);
            JSONObject gone = readFile("selftest.txt");
            return "自检通过: 写入/读取=" + r.optString("content")
                    + ", 根目录项数=" + (l.optJSONArray("items") == null ? 0 : l.optJSONArray("items").length())
                    + ", 删除后存在=" + gone.optBoolean("ok");
        } catch (Exception e) {
            return "自检失败: " + e;
        }
    }

    // ------------------------------------------------------------------
    // JS 桥
    // ------------------------------------------------------------------

    private class Bridge {
        @JavascriptInterface
        public String getState() {
            try {
                return new JSONObject()
                        .put("hasKey", !prefs().getString(KEY_API, "").isEmpty())
                        .put("rootName", hasTree() ? treeUri() : "应用私有目录")
                        .toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void goSetup() {
            runOnUiThread(MainActivity.this::showSetup);
        }

        @JavascriptInterface
        public String chat(String userText) {
            return runAgent(userText);
        }
    }

    // ------------------------------------------------------------------
    // DeepSeek 对话 + 工具循环
    // ------------------------------------------------------------------

    private static final String TOOLS = "["
            + "{\"type\":\"function\",\"function\":{\"name\":\"list_files\",\"description\":\"列出目录下的文件和文件夹\","
            + "\"parameters\":{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\",\"description\":\"相对工作目录的路径,空字符串表示根目录\"}},\"required\":[\"path\"]}}},"
            + "{\"type\":\"function\",\"function\":{\"name\":\"read_file\",\"description\":\"读取文本文件内容(二进制或超大文件会被截断)\","
            + "\"parameters\":{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"}},\"required\":[\"path\"]}}},"
            + "{\"type\":\"function\",\"function\":{\"name\":\"write_file\",\"description\":\"写入/覆盖文本文件\","
            + "\"parameters\":{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"},\"content\":{\"type\":\"string\"}},\"required\":[\"path\",\"content\"]}}},"
            + "{\"type\":\"function\",\"function\":{\"name\":\"create_folder\",\"description\":\"创建文件夹\","
            + "\"parameters\":{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"}},\"required\":[\"path\"]}}},"
            + "{\"type\":\"function\",\"function\":{\"name\":\"delete_path\",\"description\":\"删除文件或文件夹\","
            + "\"parameters\":{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"},\"isDir\":{\"type\":\"boolean\"}},\"required\":[\"path\",\"isDir\"]}}}"
            + "]";

    private String runAgent(String userText) {
        try {
            String key = prefs().getString(KEY_API, "");
            if (key.isEmpty()) {
                return new JSONObject().put("messages", new JSONArray()
                        .put(new JSONObject().put("role", "tool").put("name", "错误").put("content", "未配置 API Key"))).toString();
            }
            JSONArray messages = new JSONArray();
            messages.put(new JSONObject()
                    .put("role", "system")
                    .put("content", "你是运行在安卓手机上的本地文件助手。你可以读取、写入、创建、删除工作目录里的文件。"
                            + "工作目录是用户在手机里选择的文件夹(可能是相册、下载、文档等目录)。"
                            + "根据用户需求调用工具;不要编造文件内容,读取后再回答;写文件前如不确定内容,先询问。"
                            + "回复使用简体中文,简洁清楚。"));
            messages.put(new JSONObject().put("role", "user").put("content", userText));

            for (int round = 0; round < 10; round++) {
                JSONObject req = new JSONObject()
                        .put("model", "deepseek-chat")
                        .put("messages", messages)
                        .put("tools", new JSONArray(TOOLS))
                        .put("tool_choice", "auto");
                JSONObject resp = apiChat(key, req);
                JSONObject msg = resp.getJSONArray("choices").getJSONObject(0).getJSONObject("message");
                JSONObject push = new JSONObject().put("role", "assistant");
                if (msg.has("content") && !msg.isNull("content")) push.put("content", msg.getString("content"));
                JSONArray calls = msg.optJSONArray("tool_calls");
                if (calls != null && calls.length() > 0) {
                    push.put("tool_calls", calls);
                    messages.put(push);
                    for (int i = 0; i < calls.length(); i++) {
                        JSONObject call = calls.getJSONObject(i);
                        JSONObject fn = call.getJSONObject("function");
                        String id = call.getString("id");
                        String name = fn.getString("name");
                        String args = fn.optString("arguments", "{}");
                        JSONObject result = executeTool(name, args);
                        messages.put(new JSONObject()
                                .put("role", "tool")
                                .put("tool_call_id", id)
                                .put("name", name)
                                .put("content", result.toString()));
                    }
                    continue;
                }
                messages.put(push);
                break;
            }
            return new JSONObject().put("messages", messages).toString();
        } catch (Exception e) {
            try {
                return new JSONObject().put("messages", new JSONArray()
                        .put(new JSONObject().put("role", "tool").put("name", "错误").put("content", String.valueOf(e)))).toString();
            } catch (Exception e2) {
                return "{\"messages\":[]}";
            }
        }
    }

    private JSONObject executeTool(String name, String argsJson) {
        try {
            JSONObject args = new JSONObject(argsJson.isEmpty() ? "{}" : argsJson);
            String path = args.optString("path", "");
            switch (name) {
                case "list_files":
                    return listFiles(path);
                case "read_file":
                    return readFile(path);
                case "write_file":
                    return writeFile(path, args.optString("content", ""));
                case "create_folder":
                    return mkdir(path);
                case "delete_path":
                    return deletePath(path, args.optBoolean("isDir", false));
                default:
                    return err("未知工具: " + name);
            }
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    private JSONObject apiChat(String key, JSONObject body) throws Exception {
        URL url = new URL("https://api.deepseek.com/chat/completions");
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setRequestMethod("POST");
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("Authorization", "Bearer " + key);
        c.setDoOutput(true);
        c.setConnectTimeout(20000);
        c.setReadTimeout(180000);
        OutputStream os = c.getOutputStream();
        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        os.close();
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        byte[] data = readAll(in, 8 * 1024 * 1024);
        String text = new String(data, StandardCharsets.UTF_8);
        if (code >= 400) {
            throw new Exception("DeepSeek API " + code + ": " + text);
        }
        return new JSONObject(text);
    }
}
