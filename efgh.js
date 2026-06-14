
const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'meta', 'ilst']);
const F_SIZE = 8;
const F_BYTES = new Uint8Array([0,0,0,4,0,0,0,0]); 
const V_SCALE = 90000;
const V_DUR = 2269500;
const V_TIME = 0; 
const V_DELTA = 1500;

function getBoxType(d, o) { return String.fromCharCode(d[o], d[o+1], d[o+2], d[o+3]); }
function setBoxType(d, o, t) { for(let i=0; i<4; i++) d[o+i] = t.charCodeAt(i); }

function readBox(v, d, o, end, pPath = '') {
    if(o+8 > end) throw new Error("Invalid MP4");
    let s = v.getUint32(o, false), t = getBoxType(d, o+4), size = s, hs = 8;
    if(s === 1) { 
        size = v.getUint32(o+8, false)*4294967296 + v.getUint32(o+12, false); 
        hs = 16;
    }
    else if(s === 0) size = end - o;
    if(size < hs || o+size > end) throw new Error("Bad box size: " + t);
    return { type: t, offset: o, size, hs, cStart: o+hs, end: o+size, path: pPath?`${pPath}/${t}`:t, data: d, view: v, children: [], pStart: o+hs, pEnd: o+hs };
}

function parseBoxes(d, v, start=0, end=d.length, path='') {
    let boxes = [], o = start;
    while(o+8 <= end) {
        let box = readBox(v, d, o, end, path);
        if(CONTAINER_BOXES.has(box.type)) {
            let cs = box.type === 'meta' ? box.cStart+4 : box.cStart;
            box.pStart = box.cStart; box.pEnd = cs;
            box.children = parseBoxes(d, v, cs, box.end, box.path);
        }
        boxes.push(box); o = box.end;
    }
    return boxes;
}

function findChild(b, t) { return b.children.find(c => c.type === t); }
function findDescendant(b, p) { 
    let c = b;
    for(let t of p) { c = findChild(c, t); if(!c) return null; } 
    return c;
}

function makeBox(t, p) {
    let b = new Uint8Array(8+p.length), v = new DataView(b.buffer);
    v.setUint32(0, b.length, false);
    setBoxType(b, 4, t); b.set(p, 8); return b;
}
function concatBytes(arr) {
    let out = new Uint8Array(arr.reduce((s, p) => s + p.length, 0)), o = 0;
    arr.forEach(p => { out.set(p, o); o += p.length; }); return out;
}

function checkHasCo64(buffer) {
    let d = new Uint8Array(buffer), v = new DataView(buffer);
    try {
        let boxes = parseBoxes(d, v);
        let moov = boxes.find(b => b.type === 'moov');
        if(!moov) return false;
        let vTrak = moov.children.find(c => c.type === 'trak' && getBoxType(findDescendant(c, ['mdia','hdlr']).data, findDescendant(c, ['mdia','hdlr']).offset+16) === 'vide');
        if(!vTrak) return false;
        let stbl = findDescendant(vTrak, ['mdia','minf','stbl']);
        return findChild(stbl, 'co64') !== undefined;
    } catch(e) {
        return false;
    }
}

function applySharkPatch(buffer) {
    let d = new Uint8Array(buffer), v = new DataView(buffer), boxes = parseBoxes(d, v);
    let ftyp = boxes.find(b=>b.type==='ftyp'), moov = boxes.find(b=>b.type==='moov'), mdat = boxes.find(b=>b.type==='mdat');
    if(!ftyp || !moov || !mdat) throw new Error("Missing ftyp/moov/mdat");
    
    let vTrak = moov.children.find(c => c.type === 'trak' && getBoxType(findDescendant(c, ['mdia','hdlr']).data, findDescendant(c, ['mdia','hdlr']).offset+16) === 'vide');
    if(!vTrak) throw new Error("Video track not found");
    
    let stbl = findDescendant(vTrak, ['mdia','minf','stbl']);
    if(!stbl) throw new Error("Missing stbl box");
    if(findChild(stbl, 'co64')) throw new Error("co64 safety triggered inside patcher");
    
    let mdhd = findDescendant(vTrak, ['mdia','mdhd']);
    let elst = findDescendant(vTrak, ['edts','elst']);
    let vStts = findChild(stbl, 'stts'), vStsc = findChild(stbl, 'stsc'), vStsz = findChild(stbl, 'stsz'), vStco = findChild(stbl, 'stco');
    
    if (!mdhd || !elst || !vStts || !vStsc || !vStsz || !vStco) {
        throw new Error("Missing required sample table boxes (mdhd, elst, stts, stsc, stsz, stco)");
    }

    function parseStsz(box) {
        let sSize = box.view.getUint32(box.offset + 12, false), count = box.view.getUint32(box.offset + 16, false);
        if (sSize) return new Array(count).fill(sSize);
        let sizes = [];
        for(let i=0; i<count; i++) sizes.push(box.view.getUint32(box.offset + 20 + i*4, false));
        return sizes;
    }
    function parseStsc(box) {
        let count = box.view.getUint32(box.offset + 12, false), rows = [];
        for(let i=0; i<count; i++) {
            let off = box.offset + 16 + i*12;
            rows.push([box.view.getUint32(off, false), box.view.getUint32(off+4, false), box.view.getUint32(off+8, false)]);
        }
        return rows;
    }
    function parseStco(box) {
        let count = box.view.getUint32(box.offset + 12, false), offsets = [];
        for(let i=0; i<count; i++) offsets.push(box.view.getUint32(box.offset + 16 + i*4, false));
        return offsets;
    }

    let oSizes = parseStsz(vStsz), oRows = parseStsc(vStsc), oOffsets = parseStco(vStco);
    

    let realSampleCount = oSizes.length;
    let dynamicFakeCount = realSampleCount * 9;
    
    let pMdhd = d.slice(mdhd.cStart, mdhd.end);
    new DataView(pMdhd.buffer).setUint32(12, V_SCALE, false); 
    new DataView(pMdhd.buffer).setUint32(16, V_DUR, false);

   
    let pElst = d.slice(elst.cStart, elst.end); 
    new DataView(pElst.buffer).setUint32(12, V_TIME, false);
    
    
    let pStts = new Uint8Array(24), vts = new DataView(pStts.buffer);
    vts.setUint32(4, 2, false); 
    vts.setUint32(8, realSampleCount, false); 
    vts.setUint32(12, V_DELTA, false);
    vts.setUint32(16, dynamicFakeCount, false); 
    vts.setUint32(20, V_DELTA, false);
    
  
    let pStsz = new Uint8Array(12 + (realSampleCount + dynamicFakeCount)*4), vsz = new DataView(pStsz.buffer);
    vsz.setUint32(8, realSampleCount + dynamicFakeCount, false);
    oSizes.forEach((sz, i) => vsz.setUint32(12+i*4, sz, false));
    for(let i=0; i<dynamicFakeCount; i++) vsz.setUint32(12+(realSampleCount+i)*4, F_SIZE, false);
    
  
    let pRows = [...oRows];
    if(!pRows.length || pRows[pRows.length-1][1] !== 1) pRows.push([oOffsets.length+1, 1, 1]);
    let pStsc = new Uint8Array(8 + pRows.length*12), vsc = new DataView(pStsc.buffer);
    vsc.setUint32(4, pRows.length, false);
    pRows.forEach((r, i) => { vsc.setUint32(8+i*12, r[0], false); vsc.setUint32(12+i*12, r[1], false); vsc.setUint32(16+i*12, r[2], false); });
    
   
    function buildStcoRep(stcoBox, delta, fOff) {
        let origOffsets = parseStco(stcoBox);
        let isVideo = (stcoBox === vStco); 
        let totalCount = origOffsets.length + (isVideo ? dynamicFakeCount : 0);
        
        let p = new Uint8Array(8 + totalCount*4), boxView = new DataView(p.buffer);
        boxView.setUint32(4, totalCount, false);
        origOffsets.forEach((off, i) => boxView.setUint32(8 + i*4, off + delta, false));
        
        if (isVideo && fOff !== null) {
            for(let i=0; i<dynamicFakeCount; i++) boxView.setUint32(8 + (origOffsets.length+i)*4, fOff, false);
        }
        return makeBox('stco', p);
    }

    let fixed = new Map([[mdhd, makeBox('mdhd', pMdhd)], [elst, makeBox('elst', pElst)], [vStts, makeBox('stts', pStts)], [vStsc, makeBox('stsc', pStsc)], [vStsz, makeBox('stsz', pStsz)]]);
    
    function rebuild(b, rep) {
        if(rep.has(b)) return rep.get(b);
        if(!b.children.length) return b.data.slice(b.offset, b.end);
        let pts = [b.data.slice(b.pStart, b.pEnd)];
        b.children.forEach(c => pts.push(rebuild(c, rep)));
        return makeBox(b.type, concatBytes(pts));
    }

    let allStcos = [];
    moov.children.filter(c=>c.type==='trak').forEach(t=>{
        let st = findDescendant(t, ['mdia','minf','stbl']);
        if(st && findChild(st, 'stco')) allStcos.push(findChild(st, 'stco'));
    });
    
    let rep1 = new Map(fixed);
    allStcos.forEach(s => rep1.set(s, buildStcoRep(s, 0, 0)));
    let moov1 = rebuild(moov, rep1);
    
    let presBytes = concatBytes(boxes.filter(b=>!['ftyp','moov','mdat'].includes(b.type)).map(b=>b.data.slice(b.offset, b.end)));
    let oMdatStart = mdat.cStart, oMdatPl = d.slice(mdat.cStart, mdat.end);
    
    let nStart = ftyp.size + moov1.length + presBytes.length + 8;
    let delta = nStart - oMdatStart;
    let fakeOffset = nStart + oMdatPl.length;
    
    let repFinal = new Map(fixed);
    allStcos.forEach(s => repFinal.set(s, buildStcoRep(s, delta, fakeOffset)));
    
    return concatBytes([d.slice(ftyp.offset, ftyp.end), rebuild(moov, repFinal), presBytes, makeBox('mdat', concatBytes([oMdatPl, F_BYTES]))]);
}

window.processSharkMethod = async function() {
    let opt = document.querySelector('input[name="sharkOpt"]:checked').value;
    let outName = `YZ_${window.selectedFile.name.replace(/\.[^/.]+$/, "")}.mp4`;
    
    if(opt === 'fast') {
        let buf = await window.selectedFile.arrayBuffer();
        
        try {

            if(checkHasCo64(buf)) throw new Error("co64 triggers remux");
            
            let patchedBuffer = applySharkPatch(buf);
            window.downloadBlob(patchedBuffer, outName);
            
        } catch(error) {

            console.log("Direct fast patch failed, performing auto-remux fallback: ", error.message);
            
            if(!window.isEngineLoaded) {
                throw new Error("ဗီဒီယိုဖိုင် Box အပြည့်အစုံမပါဝင်ပါ သို့မဟုတ် 64-bit ဖြစ်နေသည်။ Engine Load ပြီးမှသာ အသုံးပြုနိုင်ပါမည်။");
            }
            
        
            window.ffmpeg.FS('writeFile', 'in_remux.mp4', await FFmpeg.fetchFile(window.selectedFile));
            await window.ffmpeg.run('-i', 'in_remux.mp4', '-c', 'copy', 'out_remux.mp4');
            let fixedData = window.ffmpeg.FS('readFile', 'out_remux.mp4');
            

            let patchedBuffer = applySharkPatch(fixedData.buffer);
            window.downloadBlob(patchedBuffer, outName);
            
            window.ffmpeg.FS('unlink', 'in_remux.mp4');
            window.ffmpeg.FS('unlink', 'out_remux.mp4');
        }
        
    } else {
       
        window.ffmpeg.FS('writeFile', 'in.mp4', await FFmpeg.fetchFile(window.selectedFile));
        await window.ffmpeg.run('-i', 'in.mp4', '-preset', 'ultrafast', '-b:v', '10M', '-r', '60', 'tmp.mp4');
        let data = window.ffmpeg.FS('readFile', 'tmp.mp4');
        
        window.downloadBlob(applySharkPatch(data.buffer), outName);
        
        window.ffmpeg.FS('unlink', 'in.mp4');
        window.ffmpeg.FS('unlink', 'tmp.mp4');
    }
};
