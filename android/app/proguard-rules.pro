# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# Capacitor / WebView keep-rules (required once minifyEnabled = true / R8).
# Capacitor resolves plugins by class name via reflection and bridges JS
# through @JavascriptInterface; without these, R8 strips them -> runtime crash.
# ---------------------------------------------------------------------------

# Capacitor plugins are loaded reflectively (@CapacitorPlugin / Plugin subclass).
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod public <methods>;
}

# Methods exposed to the WebView JS bridge.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor + Cordova framework cores (reflection, plugin registry).
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**

# Amazon Appstore SDK (transitive, e.g. via RevenueCat): old bytecode trips R8
# stack-map warnings. Silence them; keep the SDK if you ship to Amazon Appstore.
-dontwarn com.amazon.**

# Preserve annotations and readable crash stack traces.
-keepattributes *Annotation*, JavascriptInterface, SourceFile, LineNumberTable
