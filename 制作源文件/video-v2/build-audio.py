from pathlib import Path
import json, math, re, subprocess, hashlib
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 48000
DURATION = 66.0
N = int(SR * DURATION)
STARTS = [0.8, 10.2, 20.2, 31.0, 42.0, 56.0]
SEED = 20261014
rng = np.random.default_rng(SEED)


def ffmpeg(*args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', *map(str, args)], check=True, capture_output=True)


def decode(path, filters=None):
    args = ['-loglevel', 'error', '-i', path]
    if filters:
        args += ['-af', filters]
    result = ffmpeg(*args, '-ar', SR, '-ac', 2, '-f', 'f32le', 'pipe:1')
    return np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2).astype(np.float64)


def write_wav(path, data):
    subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
                    '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
                    '-c:a', 'pcm_s24le', str(path)],
                   input=np.asarray(data, dtype='<f4').tobytes(), check=True)


def fit(data):
    result = np.zeros((N, 2), dtype=np.float64)
    length = min(N, len(data))
    result[:length] = data[:length]
    return result


def normalize_rms(data, rms):
    return data * (rms / max(float(np.sqrt(np.mean(data * data))), 1e-9))


def band_noise(seconds, low, high, rms):
    n = int(round(seconds * SR))
    f = np.fft.rfftfreq(n, 1 / SR)
    # Smooth spectral rolls avoid metallic resonances and harsh aliasing.
    response = (f / np.maximum(f + low, 1)) ** 2 / (1 + (f / high) ** 4)
    response[0] = 0
    independent = []
    for _ in range(2):
        noise = rng.standard_normal(n)
        independent.append(np.fft.irfft(np.fft.rfft(noise) * response, n))
    a, b = independent
    stereo = np.column_stack((a, a * .82 + b * .18))
    return normalize_rms(stereo, rms)


def taper(data, attack=.12, release=.3):
    env = np.ones(len(data))
    a = min(int(attack * SR), len(data))
    r = min(int(release * SR), len(data))
    env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    env[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return data * env[:, None]


def add_at(bus, data, start):
    index = int(round(start * SR))
    length = min(len(data), len(bus) - index)
    bus[index:index + length] += data[:length]


def db(x):
    return 20 * math.log10(max(float(x), 1e-12))


def json_from_log(log):
    matches = re.findall(r'\{\s*"input_i"[\s\S]*?\}', log)
    if not matches:
        raise RuntimeError('ffmpeg did not provide loudness measurement JSON')
    return json.loads(matches[-1])


# All environmental sounds are original deterministic synthesis, not recordings
# from Jiangmen. No downloaded samples, no new TTS, no voice processing/retiming.
voice_bus = np.zeros((N, 2), dtype=np.float64)
voice_reports = []
for i, start in enumerate(STARTS):
    path = ROOT / f'voice-{i}.wav'
    audio = decode(path)
    add_at(voice_bus, audio, start)
    silence_log = ffmpeg('-i', path, '-af', 'silencedetect=noise=-36dB:d=0.12', '-f', 'null', '-').stderr.decode('utf-8', errors='replace')
    silence_pairs = re.findall(r'silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)', silence_log)
    voice_reports.append({
        'file': path.name, 'start': start, 'duration': round(len(audio)/SR, 6),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'sample_peak_dbfs': round(db(np.max(np.abs(audio))), 2),
        'silences_local_seconds': [[float(a), float(b)] for a,b in silence_pairs]
    })

ambience = np.zeros((N, 2), dtype=np.float64)
# Gentle paper unfolding and closing: filtered noise with a few soft folds.
for start, duration, strength in [(0.06, 1.85, .008), (2.6, .70, .0035),
                                   (54.2, .75, .004), (64.0, 1.15, .005)]:
    a = band_noise(duration, 500, 4100, strength)
    t = np.arange(len(a)) / SR
    mod = .35 + .65 * np.sin(np.pi * np.minimum(t / duration, 1)) ** 2
    mod *= .68 + .20*np.sin(t*21) + .12*np.sin(t*47+.7)
    a *= mod[:,None]
    add_at(ambience, taper(a, .07, .24), start)

# Roof rain: soft distant patter with no prominent continuous hiss.
rain = band_noise(11.5, 1100, 4200, .0032)
rt = np.arange(len(rain))/SR
rain *= (.64 + .18*np.sin(rt*.9) + .18*np.sin(rt*2.4+.9))[:,None]
for at in np.sort(rng.uniform(.35, 11.0, 48)):
    length = .027 + rng.uniform(0,.028)
    drop = band_noise(length, 700, 3400, rng.uniform(.002,.008))
    drop *= np.exp(-np.arange(len(drop))/SR*80)[:,None]
    add_at(rain, taper(drop, .002, .010), float(at))
add_at(ambience, taper(rain, 1.0, 1.1), 18.5)

# Wide river wash: low, slow, non-tonal movement and a very subtle fine surface.
water = band_noise(11, 180, 1300, .0065)
wt = np.arange(len(water))/SR
water *= (.57 + .22*np.sin(wt*1.12+.2) + .15*np.sin(wt*2.07+2))[:,None]
add_at(ambience, taper(water, 1.0, 1.3), 30.0)

# Bamboo tray/peel rub: three restrained dry handling gestures, mostly in gaps.
for start, duration in [(41.1,.62),(47.65,.56),(52.2,.80)]:
    rub = band_noise(duration, 650, 2600, .006)
    xt = np.arange(len(rub))/SR
    rub *= (.45+.55*np.sin(np.pi*xt/duration)**2)[:,None]
    add_at(ambience, taper(rub,.1,.21), start)

# Derive one shared speech envelope. The voice is never filtered or sped up.
block = 480
blocks = voice_bus[:,0].reshape(-1, block)
rms = np.sqrt(np.mean(blocks * blocks, axis=1))
level_db = 20*np.log10(np.maximum(rms, 1e-8))
activity = np.clip((level_db + 48) / 24, 0, 1)
activity = np.maximum(activity, np.r_[activity[1:], 0] * .8) # 10 ms lookahead
smooth = np.empty_like(activity)
prev = 0.
for j, x in enumerate(activity):
    coeff = math.exp(-.01/(.06 if x > prev else .48))
    prev = coeff*prev+(1-coeff)*x
    smooth[j] = prev
speech = np.interp(np.arange(N)/SR, np.arange(len(smooth))*.01, smooth)

# Spectral carve and fader duck are baked into one frozen premix so the source
# HTML and render play the exact same audio on any HyperFrames version.
music = fit(decode(ROOT/'music.wav'))
carved = fit(decode(ROOT/'music.wav',
    'equalizer=f=700:t=q:w=0.8:g=-3,equalizer=f=1550:t=q:w=0.8:g=-6,equalizer=f=2700:t=q:w=1.1:g=-3'))
music_mix = music*(1-speech[:,None]) + carved*speech[:,None]
music_gain = .34 - .14 * speech
clock = np.arange(N)/SR
music_gain *= np.minimum(clock/1.0, 1)
music_gain *= np.clip((66-clock)/4.2, 0, 1)
music_mix *= music_gain[:,None]
# Keep sound design subordinate to the same speech envelope.
ambience *= (1-.4*speech)[:,None]
write_wav(ROOT/'ambience.wav', ambience)
write_wav(ROOT/'music-carved.wav', music_mix)
write_wav(ROOT/'voice-bus.wav', voice_bus)
raw = voice_bus + music_mix + ambience
write_wav(ROOT/'premix.wav', raw)

first = ffmpeg('-i', ROOT/'premix.wav', '-af',
               'loudnorm=I=-17.5:TP=-2:LRA=9:print_format=json', '-f', 'null', '-')
m = json_from_log(first.stderr.decode('utf-8', errors='replace'))
normalization = ('loudnorm=I=-17.5:TP=-2:LRA=9:linear=true:'
    f'measured_I={m["input_i"]}:measured_TP={m["input_tp"]}:'
    f'measured_LRA={m["input_lra"]}:measured_thresh={m["input_thresh"]}:'
    f'offset={m["target_offset"]}:print_format=json')
ffmpeg('-loglevel', 'info', '-y', '-i', ROOT/'premix.wav', '-af', normalization,
       '-ar', SR, '-ac', 2, '-t', DURATION, '-c:a', 'pcm_s24le', ROOT/'final-mix.wav')
measured_log = ffmpeg('-i', ROOT/'final-mix.wav', '-af',
                     'loudnorm=I=-17.5:TP=-2:LRA=9:print_format=json', '-f','null','-')
measured = json_from_log(measured_log.stderr.decode('utf-8', errors='replace'))

# Waveform-assisted manual caption alignment. The intervals below were assigned
# from the actual silencedetect gaps and original punctuation; these are NOT ASR.
# Short unpaused clauses are retained together instead of inventing a pause.
phrases = [
 [(0.12,1.19,'亲爱的你，'),(1.32,2.34,'有些故乡，'),(2.40,4.17,'远行之后才读懂。'),
  (4.64,6.13,'让我们沿着一封信，'),(6.20,7.36,'走进江门。')],
 [(0.13,1.12,'楼的远望，'),(1.20,3.95,'是把远方的见闻砌进砖石，'),(4.09,6.43,'把故乡的牵挂留在窗前。')],
 [(0.12,1.79,'屋檐接住岭南的雨，'),(1.91,3.81,'长街留住日常的暖。'),
  (4.24,5.25,'一声问候，'),(5.33,7.05,'就是乡情的回响。')],
 [(0.11,2.05,'江水向远处流去，'),(2.16,3.88,'思念沿来路回响。'),
  (4.29,5.84,'水的方向是远方，'),(5.92,7.49,'心的方向是故乡。')],
 [(0.12,2.52,'一瓣陈皮，收好阳光。'),(2.89,3.73,'一双手，'),(3.85,5.42,'把时光传下去。'),
  (5.85,7.34,'敬每一份手艺，'),(7.45,8.95,'也敬家的味道。')],
 [(0.11,1.47,'从世界走来，'),(1.53,2.96,'向故乡望去。'),
  (3.40,4.60,'寻美江门，'),(4.70,7.10,'也是寻回心里的那盏灯。')]
]
captions = [{'start':round(STARTS[i]+s,2), 'end':round(STARTS[i]+e,2), 'text':text}
            for i, ps in enumerate(phrases) for s,e,text in ps]
assert all(c['end'] > c['start'] and len(c['text']) <= 22 for c in captions)
assert all(a['end'] <= b['start'] for a,b in zip(captions,captions[1:]))
(ROOT/'captions.json').write_text(json.dumps(captions,ensure_ascii=False,indent=2),encoding='utf-8')

def stamp(seconds, comma=False):
    ms = int(round(seconds*1000))
    sep = ',' if comma else '.'
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}'

vtt = 'WEBVTT\n\n' + '\n\n'.join(f'{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for c in captions) + '\n'
srt = '\n\n'.join(f'{i+1}\n{stamp(c["start"],True)} --> {stamp(c["end"],True)}\n{c["text"]}' for i,c in enumerate(captions)) + '\n'
(ROOT/'subtitles.vtt').write_text(vtt, encoding='utf-8')
(ROOT/'subtitles.srt').write_text(srt, encoding='utf-8')
report = {
 'duration_seconds': DURATION, 'sample_rate_hz': SR, 'channels': 2,
 'source_voice': 'Previously approved Microsoft zh-CN-YunjianNeural; original WAVs preserved byte-for-byte; no new TTS, retiming or pitch shift.',
 'voice_clips': voice_reports,
 'music': {'source':'music.wav','origin':'Existing original deterministic pentatonic composition',
    'gain_range':[.20,.34], 'speech_carve_eq':[
        {'frequency_hz':700,'q':.8,'max_cut_db':-3},
        {'frequency_hz':1550,'q':.8,'max_cut_db':-6},
        {'frequency_hz':2700,'q':1.1,'max_cut_db':-3}],
    'envelope_attack_seconds':.06,'envelope_release_seconds':.48,
    'ending_fade_seconds':4.2},
 'ambience': {'origin':'Original procedural sound design, not location recording', 'random_seed':SEED,
    'events':['paper rustle 0.06-1.91, 2.60-3.30, 54.20-54.95, 64.00-65.15',
              'soft roof rain 18.50-30.00', 'river wash 30.00-41.00',
              'bamboo tray/peel rub 41.10-41.72, 47.65-48.21, 52.20-53.00'],
    'rms_dbfs':round(db(np.sqrt(np.mean(ambience*ambience))),2),
    'peak_dbfs':round(db(np.max(np.abs(ambience))),2),
    'speech_duck_max':.4},
 'master':{'method':'FFmpeg two-pass loudnorm', 'target_lufs':-17.5,'target_true_peak_dbtp':-2,
    'measured_integrated_lufs':float(measured['input_i']),
    'measured_true_peak_dbtp':float(measured['input_tp']),
    'measured_loudness_range_lu':float(measured['input_lra']),
    'measurement_raw':measured},
 'captions':{'method':'Waveform-assisted manual punctuation alignment; actual -36 dB silence analysis, no ASR claim.',
     'count':len(captions),'maximum_characters':max(len(c['text']) for c in captions)}
}
assert -18 <= report['master']['measured_integrated_lufs'] <= -17
assert report['master']['measured_true_peak_dbtp'] <= -1.5
(ROOT/'audio-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'duration':66,'master':report['master'],'captions':report['captions'], 'ambience':report['ambience']},ensure_ascii=False,indent=2))
