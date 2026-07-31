import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as poseDetection from '@tensorflow-models/pose-detection';
import sharp from 'sharp';
import { logger } from '../../config/logger';

/**
 * Single-photo body estimation — proportions and a suggested size band, NOT tailoring-grade
 * measurements. A single 2D image has no depth information, so circumferences (chest/waist/hip
 * in cm) cannot be derived reliably from it — any tool claiming otherwise from one front-facing
 * photo is guessing. What IS feasible from one photo + pose keypoints: body proportions (shoulder
 * width, torso/leg ratio) relative to the person's own height, which are enough for a rough build
 * / body-shape classification and a suggested size band — always shipped with a visible confidence
 * level, never as an exact measurement.
 *
 * Model: MoveNet Lightning (@tensorflow-models/pose-detection), TensorFlow.js CPU backend — same
 * pattern as BlazeFace in facePreservation.ts (no native canvas / tfjs-node on Windows).
 */

export type BodyBuild = 'slim' | 'athletic' | 'average' | 'curvy' | 'plus';
export type BodyShape = 'rectangle' | 'hourglass' | 'pear' | 'apple' | 'inverted_triangle';
export type Confidence = 'low' | 'medium' | 'high';

export interface BodyEstimateResult {
  feasible: boolean;
  reason?: string;
  build?: BodyBuild;
  bodyShape?: BodyShape;
  suggestedSizeBand?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  /** Only populated when the caller supplied their own height as a calibration reference — never invented. */
  estimatedHeightCm?: number;
  confidence: Confidence;
  confidenceScore: number; // 0-1, drives the label above
  notes: string[];
}

let detectorPromise: Promise<poseDetection.PoseDetector> | null = null;
let tfReadyPromise: Promise<void> | null = null;

async function ensureTfBackend(): Promise<void> {
  if (!tfReadyPromise) {
    tfReadyPromise = (async () => {
      await tf.setBackend('cpu');
      await tf.ready();
    })();
  }
  await tfReadyPromise;
}

async function ensureDetector(): Promise<poseDetection.PoseDetector> {
  await ensureTfBackend();
  if (!detectorPromise) {
    detectorPromise = poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
  }
  return detectorPromise;
}

const KEY = {
  nose: 'nose',
  leftShoulder: 'left_shoulder',
  rightShoulder: 'right_shoulder',
  leftHip: 'left_hip',
  rightHip: 'right_hip',
  leftKnee: 'left_knee',
  rightKnee: 'right_knee',
  leftAnkle: 'left_ankle',
  rightAnkle: 'right_ankle',
} as const;

function kp(keypoints: poseDetection.Keypoint[], name: string) {
  return keypoints.find((k) => k.name === name);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * @param imageBuffer decoded person photo (JPEG/PNG/WebP)
 * @param referenceHeightCm optional — the user's own stated height, used only to convert pixel
 *   proportions to an approximate cm scale for the size-band suggestion. We never infer height
 *   from the image itself (a single photo has no absolute scale reference).
 */
export async function estimateBodyFromImage(
  imageBuffer: Buffer,
  referenceHeightCm?: number
): Promise<BodyEstimateResult> {
  const notes: string[] = [];

  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(640, 640, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imageTensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  let poses: poseDetection.Pose[];
  try {
    const detector = await ensureDetector();
    poses = await detector.estimatePoses(imageTensor as unknown as tf.Tensor3D, {
      flipHorizontal: false,
    });
  } finally {
    imageTensor.dispose();
  }

  if (!poses.length) {
    return {
      feasible: false,
      reason: 'no_person_detected',
      confidence: 'low',
      confidenceScore: 0,
      notes: ['No full-body pose could be detected in this photo.'],
    };
  }

  const { keypoints } = poses[0];
  const nose = kp(keypoints, KEY.nose);
  const lShoulder = kp(keypoints, KEY.leftShoulder);
  const rShoulder = kp(keypoints, KEY.rightShoulder);
  const lHip = kp(keypoints, KEY.leftHip);
  const rHip = kp(keypoints, KEY.rightHip);
  const lKnee = kp(keypoints, KEY.leftKnee);
  const rKnee = kp(keypoints, KEY.rightKnee);
  const lAnkle = kp(keypoints, KEY.leftAnkle);
  const rAnkle = kp(keypoints, KEY.rightAnkle);

  const CONF_MIN = 0.35;
  const have = (p?: poseDetection.Keypoint) => !!p && (p.score ?? 0) >= CONF_MIN;

  if (!have(lShoulder) || !have(rShoulder) || !have(lHip) || !have(rHip)) {
    return {
      feasible: false,
      reason: 'incomplete_body_visible',
      confidence: 'low',
      confidenceScore: 0.1,
      notes: [
        'Shoulders and hips need to be clearly visible for even a rough estimate.',
        'Ask for a full-body photo, arms slightly away from the torso, plain background.',
      ],
    };
  }

  const legsVisible = have(lAnkle) && have(rAnkle) && have(lKnee) && have(rKnee);
  if (!legsVisible) notes.push('Legs were partly out of frame — proportions are less reliable.');

  const shoulderWidth = dist(lShoulder!, rShoulder!);
  const hipWidth = dist(lHip!, rHip!);
  const shoulderMid = { x: (lShoulder!.x + rShoulder!.x) / 2, y: (lShoulder!.y + rShoulder!.y) / 2 };
  const hipMid = { x: (lHip!.x + rHip!.x) / 2, y: (lHip!.y + rHip!.y) / 2 };
  const torsoLength = dist(shoulderMid, hipMid);
  const legLength = legsVisible
    ? dist(hipMid, { x: (lAnkle!.x + rAnkle!.x) / 2, y: (lAnkle!.y + rAnkle!.y) / 2 })
    : null;
  const pixelHeight = nose && legsVisible ? dist(nose, { x: (lAnkle!.x + rAnkle!.x) / 2, y: (lAnkle!.y + rAnkle!.y) / 2 }) * 1.08 : null; // +8% head-crown fudge past the nose keypoint

  const shoulderHipRatio = shoulderWidth / hipWidth;
  const torsoLegRatio = legLength ? torsoLength / legLength : null;

  // Rough, explicitly-heuristic classification — not a clinical or tailoring standard.
  let bodyShape: BodyShape;
  if (shoulderHipRatio > 1.12) bodyShape = 'inverted_triangle';
  else if (shoulderHipRatio < 0.88) bodyShape = 'pear';
  else if (shoulderHipRatio >= 0.95 && shoulderHipRatio <= 1.05) bodyShape = 'rectangle';
  else bodyShape = hipWidth > shoulderWidth ? 'hourglass' : 'apple';

  let build: BodyBuild = 'average';
  if (pixelHeight) {
    const shoulderToHeight = shoulderWidth / pixelHeight;
    if (shoulderToHeight < 0.19) build = 'slim';
    else if (shoulderToHeight > 0.26) build = 'plus';
    else if (shoulderToHeight > 0.235) build = 'curvy';
    else build = 'athletic';
  }

  let estimatedHeightCm: number | undefined;
  let sizeBand: BodyEstimateResult['suggestedSizeBand'];
  if (referenceHeightCm && referenceHeightCm > 100 && referenceHeightCm < 230) {
    estimatedHeightCm = referenceHeightCm;
    // Map shoulder-width-to-height ratio, calibrated by the user's real height, onto a generic band.
    // This is a coarse heuristic, not a brand-specific size chart — brands should still expose their own.
    const shoulderCmApprox = pixelHeight ? (shoulderWidth / pixelHeight) * referenceHeightCm : null;
    if (shoulderCmApprox) {
      if (shoulderCmApprox < 38) sizeBand = 'XS';
      else if (shoulderCmApprox < 41) sizeBand = 'S';
      else if (shoulderCmApprox < 44) sizeBand = 'M';
      else if (shoulderCmApprox < 47) sizeBand = 'L';
      else if (shoulderCmApprox < 50) sizeBand = 'XL';
      else sizeBand = 'XXL';
    }
  } else {
    notes.push('No reference height provided — size band is proportion-only and less precise. Ask the user for their height to improve it.');
  }

  // Confidence: average keypoint score across the points we actually used, penalized for missing legs.
  const usedPoints = [lShoulder, rShoulder, lHip, rHip, ...(legsVisible ? [lKnee, rKnee, lAnkle, rAnkle] : [])];
  const avgScore = usedPoints.reduce((s, p) => s + (p?.score ?? 0), 0) / usedPoints.length;
  let confidenceScore = avgScore;
  if (!legsVisible) confidenceScore *= 0.7;
  if (!referenceHeightCm) confidenceScore *= 0.85;
  confidenceScore = Math.round(confidenceScore * 100) / 100;

  const confidence: Confidence = confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.45 ? 'medium' : 'low';

  notes.push('This is an estimate from body proportions, not a tailoring measurement — treat suggested size as a starting point.');

  logger.info('Body estimate computed', { bodyShape, build, confidence, hasReferenceHeight: !!referenceHeightCm });

  return {
    feasible: true,
    build,
    bodyShape,
    suggestedSizeBand: sizeBand,
    estimatedHeightCm,
    confidence,
    confidenceScore,
    notes,
  };
}
