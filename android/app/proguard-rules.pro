# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep model classes
-keep class com.benedek.app.** { *; }

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep public class com.getcapacitor.annotation.CapacitorPlugin
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin public *;
}

# Keep JavaScript interfaces
-keepattributes JavascriptInterface
-keep class * extends com.getcapacitor.JSObject { *; }
-keepclassmembers class * extends com.getcapacitor.JSObject {
    <fields>;
}

# Keep plugin classes
-keep class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.Plugin {
    public <init>(com.getcapacitor.PluginCall);
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Parcelable classes
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    !private <fields>;
    !private <methods>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep WebView JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep R classes
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Cordova classes
-keep public class org.apache.cordova.* { *; }

# Keep Multidex classes
-keep class androidx.multidex.** { *; }

# Keep Geolocation classes
-keep class com.capacitorjs.plugins.geolocation.** { *; }

# Keep Haptics classes
-keep class com.capacitorjs.plugins.haptics.** { *; }

# Keep Keyboard classes
-keep class com.capacitorjs.plugins.keyboard.** { *; }

# Keep StatusBar classes
-keep class com.capacitorjs.plugins.statusbar.** { *; }

# Keep App classes
-keep class com.capacitorjs.plugins.app.** { *; }

# Keep WebView classes
-keep class * extends android.webkit.WebView { *; }
-keep class * extends android.webkit.WebViewClient { *; }

# Keep JavaScript interfaces
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Annotation classes
-keepattributes *Annotation*

# Keep Exceptions
-keepattributes Exceptions

# Keep InnerClasses
-keepattributes InnerClasses

# Keep Signature
-keepattributes Signature

# Keep SourceFile and LineNumberTable for better crash reports
-keepattributes SourceFile,LineNumberTable

# Remove logging
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}