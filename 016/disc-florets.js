const lerp = require('lerp')
const quad = require('../common/quads')
const glsl = require('glslify')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const vec3 = require('gl-vec3')
const TAU = 6.283185307179586
const origin = [0, 0, 0]

const FLORET_W = 0.25
const FLORET_H = 0.015
const FLORET_D = 0.03
const FLORET_COUNT = 400
const FLORET_ROTATE_X = TAU * 0.0
const FLORET_ROTATE_Z = TAU * 0
const FLORET_TAPER = 0.4
const SPIRAL_ROTATE = TAU * 0.051
const SPIRAL_UP = 0.00035
const SPIRAL_UP_DECAY = 1
const SPIRAL_SIZE = 0.995
const BASE_OFFSET = -0.15
const FLORET_CURL_IN = 1

module.exports = function discFlorets (regl) {
  const mesh = createMesh()
  const drawDiscFlorets = createDrawDiscFlorets(regl, mesh)
  return drawDiscFlorets
}

function createMesh () {
  const mesh = quad.createBox(FLORET_W, FLORET_H, FLORET_D)
  mesh.positions.forEach(p => {
    p[0] += FLORET_W / 2
  })

  quad.splitLoop(mesh, mesh.cells[0], 0.75)
  quad.subdivide(mesh, 1)

  // Setup some base transform for the first floret.
  mesh.positions.forEach(p => {
    const unitW = p[0] * (1 / FLORET_W)
    console.log(unitW)
    p[2] *= lerp(FLORET_TAPER, 1, unitW)
    vec3.rotateX(p, p, origin, FLORET_ROTATE_X)
    // vec3.rotateZ(p, p, origin, FLORET_ROTATE_Z)
  })

  spiralFloret(mesh, mesh.cells.slice())

  mesh.positions.forEach(p => {
    p[1] += BASE_OFFSET + vec3.squaredLength(p) * FLORET_CURL_IN
  })

  quad.computeNormals(mesh)

  return mesh
}

function spiralFloret (mesh, baseCells) {
  let spiralUp = SPIRAL_UP
  for (let i = 0; i < FLORET_COUNT; i++) {
    baseCells = quad.getNewGeometry(mesh, "cells", () => {
      const positions = quad.getNewGeometry(mesh, "positions", () => {
        quad.cloneCells(mesh, baseCells)
      })
      spiralUp *= SPIRAL_UP_DECAY
      positions.forEach(p => {
        p[0] *= SPIRAL_SIZE
        p[2] *= SPIRAL_SIZE
        p[1] *= SPIRAL_SIZE
        p[1] += spiralUp
        vec3.rotateY(p, p, origin, SPIRAL_ROTATE)
      })
    })
  }
}

function createDrawDiscFlorets (regl, mesh) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection, projView;
      uniform mat3 normalModel, normalView;
      uniform vec3 cameraPosition;
      varying vec3 vNormal, vCameraVector;

      void main() {
        vNormal = normalView * normalModel * normal;
        vCameraVector = normalView * (position.xyz - cameraPosition);

        gl_Position = projView * vec4(position, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform sampler2D matcapTexture;
      varying vec3 vNormal, vCameraVector;

      void main() {
        vec2 uv = matcap(
          normalize(vCameraVector),
          normalize(vNormal)
        );

        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals,
    },
    uniforms: {
      model: mat4.identity([]),
      normalModel: mat3.identity([]),
      matcapTexture: regl.prop('matcapTexture')
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    cull: { enable: true }
  })
}
