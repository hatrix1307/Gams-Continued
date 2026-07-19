window.RaceOffAssetChunks={framework:[],wasm:[],data:[]};
window.RaceOffCreateBlobUrl=function(chunks,type){var parts=[];for(var i=0;i<chunks.length;i++){var binary=atob(chunks[i]);var bytes=new Uint8Array(binary.length);for(var j=0;j<binary.length;j++)bytes[j]=binary.charCodeAt(j);parts.push(bytes)}return URL.createObjectURL(new Blob(parts,{type:type}))};
