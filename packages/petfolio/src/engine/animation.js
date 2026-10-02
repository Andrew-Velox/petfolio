/**
 * engine/animation.js — Pose and Animation.
 *
 * Direct port of Shimeji's animation package.
 *
 *   Pose       one sprite for `duration` ticks, plus the velocity (dx, dy)
 *              the anchor moves by on every tick the pose is shown.
 *              `ax, ay` is the pixel inside the image that sits on the
 *              mascot's anchor point (Shimeji's ImageAnchor).
 *   Animation  a looping list of poses. Which pose is shown is a pure
 *              function of the action's elapsed time:
 *                  pose = poses[ time % totalDuration ]
 *              That is the whole trick behind Shimeji's "stepping" walk
 *              and creep: velocity lives INSIDE the animation, so a pose
 *              with Velocity 0 is a pause and a pose with Velocity -2 is a
 *              stride. No separate move/pause timers needed.
 *
 * Velocity sign convention (same as Shimeji): sprites are drawn facing
 * LEFT, so dx is written for a left-facing mascot and is negated when the
 * mascot looks right.
 */

export class Pose {
  /**
   * @param {number} img       sprite number N → shime{N}.png
   * @param {number} ax        anchor x inside the image (px)
   * @param {number} ay        anchor y inside the image (px)
   * @param {number} dx        anchor x velocity (px/tick, left-facing)
   * @param {number} dy        anchor y velocity (px/tick)
   * @param {number} duration  ticks
   */
  constructor(img, ax, ay, dx, dy, duration) {
    this.img = img; this.ax = ax; this.ay = ay;
    this.dx = dx;   this.dy = dy; this.duration = duration;
  }

  apply(mascot) {
    mascot.anchor.x += mascot.lookRight ? -this.dx : this.dx;
    mascot.anchor.y += this.dy;
    mascot.pose = this;
  }
}

export class Animation {
  /**
   * @param {Pose[]} poses
   * @param {((mascot, action) => boolean) | null} condition  evaluated every tick
   */
  constructor(poses, condition = null) {
    if (!poses.length) throw new Error('Animation needs at least one pose');
    this.poses     = poses;
    this.condition = condition;
    this.duration  = poses.reduce((sum, p) => sum + p.duration, 0);
  }

  isEffective(mascot, action) {
    return this.condition ? !!this.condition(mascot, action) : true;
  }

  poseAt(time) {
    time %= this.duration;
    for (const pose of this.poses) {
      time -= pose.duration;
      if (time < 0) return pose;
    }
    return this.poses[this.poses.length - 1];
  }

  apply(mascot, time) {
    this.poseAt(time).apply(mascot);
  }
}

/** Compact constructors used by the config files. */
export const pose = (img, ax, ay, dx, dy, duration) => new Pose(img, ax, ay, dx, dy, duration);
export const anim = (poses, condition = null) => new Animation(poses, condition);
