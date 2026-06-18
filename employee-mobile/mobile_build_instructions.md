# Pagarbook Employee Portal APK Build Instructions

This manual explains how to compile the Flutter Android release APK for the employee mobile application.

---

## 📋 1. Prerequisites
Before running the build commands, verify that you have:
1. **Flutter SDK** installed and configured (version `>=3.0.0 <4.0.0`). Check status using `flutter doctor`.
2. **Android SDK & Build Tools** installed (Android Studio).
3. USB Debugging enabled (if testing on a physical device) or an active Emulator instance.

---

## 🔒 2. Permissions Configured
The following permissions are already pre-configured in [AndroidManifest.xml](file:///c:/Users/mis2/OneDrive/HRMS_Pagarbook/employee-mobile/android/app/src/main/AndroidManifest.xml):
- **Camera Access:** To capture attendance verification selfies.
- **GPS Location:** To log exact lat/long for geofencing compliance.
- **Internet Access:** To sync punches and retrieve slips.
- **Storage Read/Write:** To cache and download salary slip PDFs.

---

## ⚙️ 3. Environment Compilation Parameters
The application features a compile-time environment config class in [env.dart](file:///c:/Users/mis2/OneDrive/HRMS_Pagarbook/employee-mobile/lib/config/env.dart). You can define your production API server URL and Firebase configuration keys during the build command using `--dart-define` key-value pairs:
- `API_URL`: Base URL of the backend API (Default: `http://10.0.2.2:5000/api` for emulator localhost).
- `FIREBASE_API_KEY`: Key for Firebase services.
- `FIREBASE_PROJECT_ID`: ID of your Firebase project.

Example for compiling with a custom production server:
```bash
flutter build apk --release --dart-define=API_URL=https://api.yourdomain.com/api
```

---

## 🚀 4. Build Commands
Run the following sequential commands in your terminal from the `employee-mobile` directory:

### Step 4.1: Clean local cache
```bash
flutter clean
```

### Step 4.2: Retrieve dependencies
```bash
flutter pub get
```

### Step 4.3: Generate the Release APK
```bash
flutter build apk --release
```

Alternatively, you can compile split APKs per architecture (reduces file size for devices):
```bash
flutter build apk --split-per-abi
```

---

## 📂 5. Output Location
After a successful build, the compiled release APK will be located at:
`employee-mobile/build/app/outputs/flutter-apk/app-release.apk`
