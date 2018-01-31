var VROKITURL = "https://0rwcyzgoj9.execute-api.us-east-1.amazonaws.com/vrokit";
var _socket = io( "http://www.vrok.it"  );
var _sessionId;
var _viewer;
var _last_distance_to_target;
var _view_data_bucket = 'vrparty2';//model2017-09-18-01-44-37-d41d8cd98f00b204e9800998ecf8427e';
var _default_models = {

    'coffee'          : "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvUmV0cm9fUmVkX0NhZmZlZV9NYWNoaW5lLmYzZA",
    'Helmet'          : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvSGVsbWV0LmYzZA',
    'HandSaw'          : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvSGFuZF9Sb3V0ZXIuZjNk',
    'Revit'    : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvcmFjX2FsbHZpZXdzMy5ydnQ',
    'Level1'        : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvRG9nX0hvdXNlXzIwMTZfQ2xhc3NpZmllZF9XaXRoTWF0ZXJpYWxUZXh0dXJlLmR3Zg',
    'Optimus'          : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvT3B0aW11c19QcmltZV82LmYzZA',
    'chair'          : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvQ2hhaXIuZjNk',
    'Lego.F3Z'     : 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dnJwYXJ0eTEvXzBhY2U4ZGMxLWY4Y2YtNDI2Zi1iNzNkLTNmNTIwOTk1MzUxYS5mM2QuZjN6',

};
var _hosts = [ 'vr-party.herokuapp.com', 'www.vrok.it' ];
//var BASEURL = "http://0rwcyzgoj9.execute-api.us-east-1.amazonaws.com/vrokit";

var updateButtons = function(){
    // Populate our initial UI with a set of buttons, one for each function in the Buttons object

    var panel = document.getElementById('control');

    for (var name in _default_models) {
        var urn = _default_models[name];
        addButton(panel, name, function(urn) { return function() { launchUrn(urn); } }(urn));
    }

    // check empty
    var store = localStorage.getItem('vrokit')
    if (!store) return;

    // if expired, wipe
    store = JSON.parse(store);
    if (store.expiry < Date.now()) {
        localStorage.removeItem('vrokit');
        return;
    }

    // add buttons from localstorage
    for (var id in store.items) {
        var item = store.items[id];
        var urn = item.urn;
        addButton(panel, item.name, function(urn) { return function() { launchUrn(urn); } }(urn));
    }
}
//
//  Initialize
//

function initialize() {
    _sessionId = getURLParameter('session');
    if (_sessionId) {        
        // Only generate the UI if a session ID was passed in via the URL

        updateButtons();

        var url = "http://vrokit.s3-website-us-east-1.amazonaws.com/participant.html?session=" + _sessionId;
        $('#url').attr('href', url);
        $('#qrcode').qrcode(url);
        
        // If the provided session exists then load its data (right now just its URN)
        $.get(
            VROKITURL + '/api/getSession/' + _sessionId,
            function(req2, res2) {
                if (res2 === "success") {

                    //readCookiesForCustomModel();
                    initializeSelectFilesDialog();

                    if (req2 !== "") {
                        Autodesk.Viewing.Initializer(getViewingOptions(), function() {
                            launchUrn(req2);
                        });
                    }
                    else {
                        // Otherwise we'll create a session with this name
                        // (we may want to disable this for security reasons,
                        // but it's actually a nice way to create sessions
                        // with custom names)
                        _socket.emit('create-session', { id: _sessionId });

                        // Initialize viewing but don't start a viewer                        
                        Autodesk.Viewing.Initializer(getViewingOptions(), function() {
                        });
	                }
                }
            }
        );
    }
    else {
        // If no session was provided, redirect the browser to a session
        // generated by the server
        $.get(
            VROKITURL + '/api/sessionId',
            function(res) {
                _sessionId = res;
                window.location.href = window.location.href + "?session=" + _sessionId;
            }
        );    
    }
}


//
//  Terminate
//

function terminate() {
    if (_sessionId) {
        _socket.emit('close-session', { id: _sessionId });
    }
}


function addButton(panel, buttonName, loadFunction) {
    var button = document.createElement('div');
    button.classList.add('cmd-btn-small');

    button.innerHTML = buttonName;
    button.onclick = loadFunction;

    panel.appendChild(button);
}


function launchUrn(urn) {

    var viewerToClose;
    
    // Uninitializing the viewer helps with stability
    if (_viewer) {
        viewerToClose = _viewer;
        _viewer = null;
    }
    
    if (urn) {
        
        $('#aboutDiv').hide();
        $('#3dViewDiv').show();
        
        _socket.emit('lmv-command', { session: _sessionId, name: 'load', value: urn });
    
        urn = urn.ensurePrefix('urn:'); 
        
        Autodesk.Viewing.Document.load(
            urn,
            function(documentData) {
                var model = getModel(documentData);
                if (!model) return;
    
                _viewer = new Autodesk.Viewing.Private.GuiViewer3D($('#3dViewDiv')[0]);
                _viewer.start();

                _viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, function(){
                    _viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChange);
                    _viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, onCameraChange);
                    _viewer.addEventListener(Autodesk.Viewing.ISOLATE_EVENT, onIsolate);
                    _viewer.addEventListener(Autodesk.Viewing.HIDE_EVENT, onHide);
                    _viewer.addEventListener(Autodesk.Viewing.SHOW_EVENT, onShow);
                    _viewer.addEventListener(Autodesk.Viewing.EXPLODE_CHANGE_EVENT, onExplode);
                    _viewer.addEventListener(Autodesk.Viewing.CUTPLANES_CHANGE_EVENT,onSection);
                    _viewer.addEventListener(Autodesk.Viewing.RENDER_OPTION_CHANGED_EVENT, onRenderOption);                    
                });

                resetSize(_viewer.container);
                    
                if (viewerToClose) {
                    viewerToClose.finish();
                }
                
                loadModel(_viewer, model);
            }
        );
    }
    else {
        // Create a blank viewer on first load
        _viewer = new Autodesk.Viewing.Private.GuiViewer3D($('#3dViewDiv')[0]);
        resetSize(_viewer.container);
    }
}


function resetSize(elem, fullHeight) {
    elem.style.width = window.innerWidth - 360 + 'px'; // subtract the left column
    if (fullHeight) {
        elem.style.height = '';
    }
    else {
        elem.style.height = (window.innerHeight - 40) + 'px'; // subtract the table padding
    }
}


//
//  Viewer3D events
//

function onCameraChange(event) {
    
    // With OBJ models the target moves to keep equidistant from the camera
    // So we just check the distance from the origin rather than the target
    // It seems to work, anyway!
    var distance_to_target = _viewer.navigation.getPosition().length(); //distanceTo(_viewer.navigation.getTarget());
    if (_last_distance_to_target === undefined || Math.abs(distance_to_target - _last_distance_to_target) > 0.1) {
        _socket.emit('lmv-command', { session: _sessionId, name: 'distanceToTarget', value: distance_to_target });
        _last_distance_to_target = distance_to_target;
    }
}


// Translate a list of objects (for R13 & R14) to a list of IDs
// Socket.io prefers not to have binary content to transfer, it seems
function getIdList(ids) {
    if (ids.length > 0 && typeof ids[0] === 'object') {
       ids = ids.map(function(obj) { return obj.dbId;});
    }
    return ids;
}


function onSelectionChange(event) {
    if (_viewer.getSelectionCount() == 0) return;
    var selection = _viewer.getSelection()[0];
    _socket.emit('lmv-command', { session: _sessionId, name: 'select', value: selection });
}

function onIsolate(event) {
    _socket.emit('lmv-command', { session: _sessionId, name: 'isolate', value: getIdList(event.nodeIdArray) });
}


function onHide(event) {
    _socket.emit('lmv-command', { session: _sessionId, name: 'hide', value: getIdList(event.nodeIdArray) });
}


function onShow(event) {
    _socket.emit('lmv-command', { session: _sessionId, name: 'show', value: getIdList(event.nodeIdArray) });
}


function onExplode() {
    _socket.emit('lmv-command', { session: _sessionId, name: 'explode', value: _viewer.getExplodeScale() });
}


function onSection(event) {
    _socket.emit('lmv-command', { session: _sessionId, name: 'section', value: _viewer.getCutPlanes() });
}


function onRenderOption(event) {
    _socket.emit('lmv-command', { session: _sessionId, name: 'render', value: _viewer.impl.currentLightPreset() });
}


//
//  Models upload
//

function onFileSelect() {
    var el = document.getElementById('fileElem');
    if (el) {
        el.click();
    }
}


function cancel() {
    $(this).dialog('close');
    $('#upload-button').html('Upload file');
}


function upload() {

    $('#upload-button').html('Uploading...<div id="spinner">&#9696;</div>');
    
    var filteredForUpload = new Array();

    $(':checkbox').each(function() {
        if ($(this).is(':checked')) {
            // 'filesToUpload' seems to be not a regular array, 'filter()'' function is undefined
            for (var i = 0; i < filesToUpload.length; ++i) {
                var file = filesToUpload[i];
                if (file.name == $(this).val()) {
                    filteredForUpload.push(file);
                }
            }
        }
    });

    console.log("Filtered for upload");
    for (var i = 0; i < filteredForUpload.length; ++i) {
        var file = filteredForUpload[i];
        console.log('Selected file: ' + file.name + ' size: ' + file.size);
    }

    onUpload(filteredForUpload);

    $(this).dialog('close');
}


function deselectAllFiles() {
    $(':checkbox').prop('checked', false);
    $(":button:contains('OK')").prop("disabled", true).addClass("ui-state-disabled");
}


function selectAllFiles() {
    $(':checkbox').prop('checked', true);
    $(":button:contains('OK')").prop("disabled", false).removeClass("ui-state-disabled");
}


function initializeSelectFilesDialog() {
    var dlg = document.getElementsByName("upload-files");

    if (dlg.length == 0) {

        var dlgDiv = document.createElement("div");
        dlgDiv.id = "upload-files";
        dlgDiv.title='Uploading files';
        document.getElementsByTagName("body")[0].appendChild(dlgDiv);

        $('#upload-files').append("<p>The following files are larger than 2MB. Are you sure you want to upload them?</p>");

        var buttons = {
            Cancel: cancel,
            'OK': upload,
            'Deselect All': deselectAllFiles,
            'Select All': selectAllFiles
        };

        $('#upload-files').dialog({ 
            autoOpen: false, 
            modal: true,
            buttons: buttons,
            width:"auto",
            resizable: false,
        });
    }
}


function clearCheckBoxes() {
    var checkboxes = document.getElementById("checkboxes");
    if (checkboxes) {
        checkboxes.parentNode.removeChild(checkboxes);
    }

    checkboxes = document.createElement('div');
    checkboxes.id = "checkboxes";
    $('#upload-files').append(checkboxes);
}


function createCheckBox(fileName) {
    var id = "filename-checkbox-" + fileName;
    var checkbox = document.createElement('input');
    checkbox.id = id;
    checkbox.type = "checkbox";
    checkbox.name = "upload-files";
    checkbox.value = fileName;
    
    $("#upload-files").change(function() {
        var numberChecked = $("input[name='upload-files']:checked").size();
        if (numberChecked > 0) {
            $(":button:contains('OK')").prop("disabled", false).removeClass("ui-state-disabled");
        } else {
            $(":button:contains('OK')").prop("disabled", true).addClass("ui-state-disabled");
        }
    });

    var label = document.createElement('label');
    label.htmlFor = id;
    label.appendChild(document.createTextNode(fileName));

    var br = document.createElement('br');

    $('#checkboxes').append(checkbox);
    $('#checkboxes').append(label);
    $('#checkboxes').append(br);
}


function resetSelectedFiles() {
   var fileElem = $("#fileElem");
    fileElem.wrap("<form>").closest("form").get(0).reset();
    fileElem.unwrap();
}


function onFilesDialogCalled(files) {
    filesToUpload = [];
    var sizeLimit = 2097152; // 2MB

    clearCheckBoxes();

    var numberFilesLargerThanLimit = 0;
    for (var i = 0; i < files.length; ++i) {
        var file = files[i];
        if (file.size > sizeLimit) {
            ++numberFilesLargerThanLimit;
            createCheckBox(file.name);
        }

        filesToUpload.push(file);
    }

    // select all files in the confirmation dialog
    selectAllFiles();

    // reset FilesSet property of the input element
    resetSelectedFiles();

    if (numberFilesLargerThanLimit > 0) {
        $('#upload-files').dialog('open');
    } else {
        onUpload(filesToUpload);
    }
}


function onUpload(files) {
    $.get(
        VROKITURL + '/api/uploadtoken',
        function(accessTokenResponse) {
            console.log('accessTokenResponse: ',accessTokenResponse)
            var viewDataClient = new Autodesk.ADN.Toolkit.ViewData.AdnViewDataClient(
                'https://developer.api.autodesk.com',
                accessTokenResponse
            );
            viewDataClient.getBucketDetailsAsync(
                _view_data_bucket,
                function(bucketResponse) {
                    //onSuccess
                    console.log('Bucket details successful:');
                    console.log(bucketResponse);
                    uploadFiles(viewDataClient, _view_data_bucket, files);
                },
                function(error) {
                    //onError
                    console.log("Bucket doesn't exist");
                    console.log('Attempting to create...');
                    viewDataClient.createBucketAsync({"bucketKey":_view_data_bucket, "policyKey":"persistent"})
                }
            );
        }
    );
}


function uploadFiles(viewDataClient, bucket, files) {
    for (var i = 0; i < files.length; ++i) {
        var file = files[i];
        console.log('Uploading file: ' + file.name + ' ...');
        viewDataClient.uploadFileAsync(
            file,
            bucket,
            file.name.replace(/ /g,'_'), // Translation API cannot handle spaces...
            function(response) {
                //onSuccess
                console.log('File upload successful:');
                console.log(response);
                var fileId = response.objectId;
                var registerResponse = viewDataClient.register(fileId);

                if (registerResponse.result === 'success' ||
                    registerResponse.result === 'created') {
                    console.log('Registration result: ' + registerResponse.Result);
                    console.log('Starting translation: ' + fileId);

                    checkTranslationStatus(
                        viewDataClient,
                        fileId,
                        1000 * 60 * 5, //5 mins timeout
                        function(viewable) {
                            //onSuccess
                            console.log('Translation successful: ' + response.file.name);
                            console.log('Viewable: ');
                            console.log(viewable);

                            var urn = viewable.urn;

                            // add new button
                            var panel = document.getElementById('control');
                            var name = truncateName(response.file.name);

                            // add to localstorage and update UI
                            var store = JSON.parse(localStorage.getItem('vrokit')) || {items:[]};
                            store.expiry = Date.now() + (24*60*60*100);  // expires in 1 day
                            store.items.push( {name:name, urn:urn});
                            localStorage.setItem('vrokit',JSON.stringify(store));

                            addButton(panel, name, function(urn) { return function() { launchUrn(urn); } }(urn));

                            // open it in a viewer
                            launchUrn(urn);

                            // and store as a cookie
                            createCookieForCustomModel('custom_model_' + response.file.name, urn);
                        });
                }
            },

            //onError
            function (error) {
                console.log('File upload failed:');
                console.log(error);
            });
    }
}


function checkTranslationStatus(viewDataClient, fileId, timeout, onSuccess) {
    var startTime = new Date().getTime();
    var timer = setInterval(function() {
        var dt = (new Date().getTime() - startTime) / timeout;
        if (dt >= 1.0) {
            clearInterval(timer);
        } else {
            viewDataClient.getViewableAsync(
                fileId,
                function(response) {
                    console.log(response);
                    console.log('Translation Progress ' + fileId + ': ' + response.progress);
                    $('#upload-button').html(response.progress+'<div id="spinner">&#9696;</div>');

                    if (response.progress === 'complete') {
                        clearInterval(timer);
                        onSuccess(response);
                        $('#upload-button').html('Upload file');
                    }
                },
                function(error) {}
            );
        }
    }, 2000);
};


//
//  Models stored in cookies
//

function truncateName(name) {
    var dotIdx = name.lastIndexOf(".");
    if (dotIdx != -1) {
        var name = name.substring(0, dotIdx);

        if (name.length > 8) {
            name = name.substring(0, 8) + "...";
        }
    }

    return name;
}


function createCookieForCustomModel(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        var expires = '; expires=' + date.toGMTString();
    } else {
        var expires = '';
    }

    var urn = encodeURIComponent(value);
    document.cookie = name + '=' + urn + expires + '; path=/';
}


function readCookiesForCustomModel() {
    var prefix = 'custom_model_';
    var cookies = document.cookie.split(';');

    for (var i in cookies) {
        var c = cookies[i];
        if (c.indexOf(prefix) != -1) {
            c = c.replace(prefix, '');
            var nameValue = c.split('=');
            if (nameValue) {
                var panel = document.getElementById('control');
                addButton(panel, truncateName(nameValue[0]), function(urn) {
                    return function() { launchUrn(urn); }
                }(decodeURIComponent(nameValue[1])));
            }
        }
    }
}


function showAbout() {
    $('#aboutDiv').css('text-indent', 0);
    resetSize($('#layer2')[0], true);
    $('#3dViewDiv').hide();
    $('#aboutDiv').show();
}


// Prevent resize from being called too frequently
// (might want to adjust the timeout from 50ms)
var resize = debounce(function() {
    var div = $('#3dViewDiv');
    var viewing = div.is(':visible');
    resetSize(viewing ? _viewer.container : $('#layer2')[0], !viewing);
}, 50);