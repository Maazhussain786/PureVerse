import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Optional release signing. Create android/key.properties (gitignored) with
// storeFile / storePassword / keyAlias / keyPassword to sign release builds;
// without it, release falls back to the debug keys (fine for testing/CI).
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.aniverse.mobile"
    // Pinned: newest AGP 8.x (8.13) keeps proguard-android.txt support that
    // flutter_inappwebview needs (removed in AGP 9.0) while supporting the
    // compileSdk 36 / Kotlin 2.3 that media_kit & friends require.
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.aniverse.mobile"
        // flutter_webrtc (Watch Party voice) requires minSdk 23.
        minSdk = maxOf(flutter.minSdkVersion, 23)
        targetSdk = 35
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        // Fixed debug keystore committed to the repo so every build (local AND
        // CI) is signed with the SAME key — required for Google Sign-In, whose
        // Android OAuth client is pinned to one SHA-1. Debug keys are not secret
        // (standard password "android"); never do this with a release key.
        getByName("debug") {
            storeFile = file("aniverse-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("release") {
            val storeFilePath = keystoreProperties["storeFile"] as String?
            if (storeFilePath != null) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(storeFilePath)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
