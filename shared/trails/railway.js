// The turnout locks as the engine passes the junction. Save times keep a
// late lever pull from changing the track on an already moving train.
export function selectedRail(room, motion, marks) {
  if (!motion.alt) return motion.rail;
  const start = marks[room.id+'/'+motion.after];
  const switched = marks[room.id+'/'+motion.switchKey];
  const junction = Math.abs((motion.rail[1][0]-motion.x)/(motion.toX-motion.x));
  const takesSpur = switched !== undefined && (start === undefined || switched <= start+junction*motion.period);
  return takesSpur ? motion.alt : motion.rail;
}

export function railHeight(points, x) {
  const forward = points.at(-1)[0] > points[0][0] ? 1 : -1;
  for (let i=1;i<points.length;i++) {
    const [right, top]=points[i], [left, bottom]=points[i-1];
    if ((right-x)*forward >= 0) return bottom+(top-bottom)*(x-left)/(right-left);
  }
  return points.at(-1)[1];
}
