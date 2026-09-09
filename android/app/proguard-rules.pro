# Add project specific ProGuard rules here.
# For more details, see http://developer.android.com/guide/developing/tools/proguard.html

# ── React Native ────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# ── WatermelonDB ─────────────────────────────────────────────────────────────
-keep class com.nozbe.watermelondb.** { *; }
-keepclassmembers class com.nozbe.watermelondb.** { *; }

# ── AsyncStorage ─────────────────────────────────────────────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ── Vector Icons ─────────────────────────────────────────────────────────────
-keep class com.oblador.vectoricons.** { *; }

# ── Reanimated ───────────────────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# ── Keep JS interface annotations (JSI/JNI bridge) ───────────────────────────
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp *;
}

# ── Hermes bytecode — do not touch the engine internals ──────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.hermes.intl.** { *; }

# ── Kotlin metadata (needed by many RN libraries) ─────────────────────────────
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
