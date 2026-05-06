# face-api.js Model Weights

Place the following pre-trained model files in this folder.

Download from: https://github.com/vladmandic/face-api/tree/master/model

Required files:
- ssd_mobilenetv1_model-weights_manifest.json
- ssd_mobilenetv1_model-shard1
- face_landmark_68_model-weights_manifest.json
- face_landmark_68_model-shard1
- face_recognition_model-weights_manifest.json
- face_recognition_model-shard1

Quick download (PowerShell):
```powershell
$base = "https://raw.githubusercontent.com/vladmandic/face-api/master/model"
$files = @(
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1"
)
foreach ($f in $files) {
  Invoke-WebRequest "$base/$f" -OutFile $f
}
```

> If this folder is empty or missing, KYC face matching is silently skipped
> and the faceMatchScore will be null. OCR and completeness scoring still run.
