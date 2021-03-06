const dat = lil;

const vertexShader = `
#define GLSLIFY 1
highp float random(vec2 co)
{
    highp float a=12.9898;
    highp float b=78.233;
    highp float c=43758.5453;
    highp float dt=dot(co.xy,vec2(a,b));
    highp float sn=mod(dt,3.14);
    return fract(sin(sn)*c);
}

uniform float iTime;

attribute vec2 aSeed;
attribute float aSize;

varying float vRandColor;

void main(){
    vec3 p=position;
    
    float t=iTime*1000.;
    float v=.01;
    float s=v*t;
    // p.z=p.z+s;
    p.z=mod(p.z+s,2000.);
    
    vec4 mvPosition=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mvPosition;
    
    float pSize=aSize*(200./-mvPosition.z);
    gl_PointSize=pSize;
    
    float randColor=random(aSeed);
    vRandColor=randColor;
}
`;

const fragmentShader = `
#define GLSLIFY 1
float circle(vec2 st,float r){
    vec2 dist=st-vec2(.5);
    return 1.-smoothstep(r-(r*1.15),r,dot(dist,dist)*4.);
}

uniform vec3 iColor1;
uniform vec3 iColor2;

varying float vRandColor;

void main(){
    vec2 p=gl_PointCoord-.5+.5;
    
    vec3 color=iColor1;
    if(vRandColor>0.&&vRandColor<.5){
        color=iColor2;
    }
    
    float shape=circle(p,1.);
    
    vec3 col=color*shape;
    
    gl_FragColor=vec4(col,1.);
}
`;

interface ParticlesConfig {
    count: number;
    pointColor1: string;
    pointColor2: string;
    pointSize: number;
    angularVelocity: number;
}

class Particles extends kokomi.Component {
    count: number;
    pointColor1: string;
    pointColor2: string;
    pointSize: number;
    angularVelocity: number;
    geometry: THREE.BufferGeometry | null;
    material: THREE.ShaderMaterial | null;
    points: THREE.Points | null;
    constructor(base: kokomi.Base, config: Partial<ParticlesConfig> = {}) {
        super(base);

        const {
            count = 10000,
            pointColor1 = "#ff6030",
            pointColor2 = "#1b3984",
            pointSize = 3,
            angularVelocity = 0
        } = config;

        this.count = count;
        this.pointColor1 = pointColor1;
        this.pointColor2 = pointColor2;
        this.pointSize = pointSize;
        this.angularVelocity = angularVelocity;

        this.geometry = null;
        this.material = null;
        this.points = null;

        this.create();
    }
    create() {
        const { base, count } = this;
        const { scene } = base;

        this.dispose();

        const geometry = new THREE.BufferGeometry();
        this.geometry = geometry;

        const positions = kokomi.makeBuffer(
            count,
            () => THREE.MathUtils.randFloat(-0.5, 0.5) * 50
        );
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const seeds = kokomi.makeBuffer(
            count,
            () => THREE.MathUtils.randFloat(0, 1),
            2
        );
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 2));

        const sizes = kokomi.makeBuffer(
            count,
            () => this.pointSize + THREE.MathUtils.randFloat(0, 1),
            1
        );
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                iTime: {
                    value: 0
                },
                iColor1: {
                    value: new THREE.Color(this.pointColor1)
                },
                iColor2: {
                    value: new THREE.Color(this.pointColor2)
                }
            }
        });
        this.material = material;

        const points = new THREE.Points(geometry, material);
        this.points = points;

        this.changePos();
    }
    addExisting(): void {
        const { base, points } = this;
        const { scene } = base;

        if (points) {
            scene.add(points);
        }
    }
    update(time: number): void {
        const elapsedTime = time / 1000;

        if (this.material) {
            const uniforms = this.material.uniforms;
            uniforms.iTime.value = elapsedTime;
        }

        if (this.points) {
            this.points.rotation.z += this.angularVelocity * 0.01;
        }
    }
    changePos() {
        const { geometry, count } = this;
        if (geometry) {
            const positionAttrib = geometry.attributes.position;

            kokomi.iterateBuffer(
                positionAttrib.array,
                count,
                (arr: number[], axis: THREE.Vector3) => {
                    const theta = THREE.MathUtils.randFloat(0, 360);
                    const r = THREE.MathUtils.randFloat(10, 50);
                    const x = r * Math.cos(theta);
                    const y = r * Math.sin(theta);
                    const z = THREE.MathUtils.randFloat(0, 2000);
                    arr[axis.x] = x;
                    arr[axis.y] = y;
                    arr[axis.z] = z;
                }
            );
        }
    }
    dispose() {
        const { base } = this;
        const { scene } = base;

        if (this.geometry) {
            this.geometry.dispose();
        }

        if (this.material) {
            this.material.dispose();
        }

        if (this.points) {
            scene.remove(this.points);
        }
    }
}

const params = {
    count: 10000,
    pointColor1: "#2155CD",
    pointColor2: "#FF4949",
    angularVelocity: 0,
    fadeFactor: 0.2
};

class Sketch extends kokomi.Base {
    particles: Particles | null;
    persistenceEffect: kokomi.PersistenceEffect | null;
    constructor(sel = "#sketch") {
        super(sel);

        this.particles = null;
        this.persistenceEffect = null;
    }
    create() {
        this.createCamera();

        // new kokomi.OrbitControls(this);

        this.createParticles();

        window.addEventListener("resize", () => {
            this.createParticles();
        });

        this.createDebug();
    }
    createCamera() {
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.camera = camera;
        this.interactionManager.camera = camera;
        camera.position.z = 1000;
    }
    createParticles() {
        if (this.particles) {
            this.particles.dispose();
        }

        if (this.persistenceEffect) {
            this.persistenceEffect.disable();
        }

        const particles = new Particles(this, {
            count: params.count,
            pointColor1: params.pointColor1,
            pointColor2: params.pointColor2,
            angularVelocity: params.angularVelocity
        });
        particles.addExisting();
        this.particles = particles;

        const persistenceEffect = new kokomi.PersistenceEffect(this, {
            fadeColor: new THREE.Color("#191919"),
            fadeFactor: params.fadeFactor
        });
        persistenceEffect.addExisting();
        this.persistenceEffect = persistenceEffect;
    }
    createDebug() {
        const gui = new dat.GUI();

        gui
            .add(params, "count")
            .min(0)
            .max(50000)
            .step(1)
            .onChange(() => {
                this.createParticles();
            });

        gui.addColor(params, "pointColor1").onChange(() => {
            this.createParticles();
        });

        gui.addColor(params, "pointColor2").onChange(() => {
            this.createParticles();
        });

        gui
            .add(params, "angularVelocity")
            .min(0)
            .max(1)
            .step(0.001)
            .onChange(() => {
                this.createParticles();
            });

        gui
            .add(params, "fadeFactor")
            .min(0)
            .max(1)
            .step(0.001)
            .onChange(() => {
                this.createParticles();
            });
    }
}

const createSketch = () => {
    const sketch = new Sketch();
    sketch.create();
    return sketch;
};

createSketch();
