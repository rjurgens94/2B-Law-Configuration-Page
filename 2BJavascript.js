//Get One Record
function getRecord(queryString, blnWebResource) {
    debugger
    var userRequest = new XMLHttpRequest();
    var serverUrl;
    if (blnWebResource == true) {
        serverUrl = window.parent.Xrm.Page.context.getClientUrl();
    } else {
        serverUrl = Xrm.Page.context.getClientUrl();
    }
    var _ret;
    var ODataPath = serverUrl + "/XRMServices/2011/OrganizationData.svc" + queryString;
    userRequest.open("GET", ODataPath, false);
    userRequest.setRequestHeader("Accept", "application/json");
    userRequest.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    //alert(userRequest.status);
    userRequest.onreadystatechange = function () {
        if (this.readyState == 4) {
            debugger
            if (this.status == 200) {
                debugger
                var json = JSON.parse(userRequest.responseText);
                if ((json != undefined) && (json.d != undefined) && (json.d.results != undefined) && (json.d.results[0] != null)) {
                    _ret = json.d.results[0];
                } else {
                    return "error";
                }
            }
        }
    }
    userRequest.send();
    return _ret;
}

//Get Multiple Records
function getRecords(queryString, blnWebResource) {
    debugger
    var userRequest = new XMLHttpRequest();
    var serverUrl;
    if (blnWebResource == true) {
        serverUrl = window.parent.Xrm.Page.context.getClientUrl();
    } else {
        serverUrl = Xrm.Page.context.getClientUrl();
    }
    var _ret;
    var ODataPath = serverUrl + "/XRMServices/2011/OrganizationData.svc" + queryString;
    userRequest.open("GET", ODataPath, false);
    userRequest.setRequestHeader("Accept", "application/json");
    userRequest.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    //alert(userRequest.status);
    userRequest.onreadystatechange = function () {
        if (this.readyState == 4) {
            if (this.status === 200) {
                debugger
                var json = JSON.parse(userRequest.responseText);
                if ((json != undefined) && (json.d != undefined) && (json.d.results != undefined) && (json.d.results[0] != null)) {
                    _ret = json.d.results;
                } else {
                    return "error";
                }
            }
        }
    }
    userRequest.send();
    return _ret;
    }

    function createRecord(queryString, jsonEntity, blnWebResource) {
        debugger
        var userRequest = new XMLHttpRequest();
        var serverUrl;
        if (blnWebResource == true) {
            serverUrl = window.parent.Xrm.Page.context.getClientUrl();
        } else {
            serverUrl = Xrm.Page.context.getClientUrl();
        }
        var _ret;
        var ODataPath = serverUrl + "/XRMServices/2011/OrganizationData.svc" + queryString;
        userRequest.open("POST", encodeURI(ODataPath), false);
        userRequest.setRequestHeader("Accept", "application/json");
        userRequest.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        userRequest.setRequestHeader("OData-MaxVersion", "4.0");
        userRequest.setRequestHeader("OData-Version", "4.0");
        userRequest.setRequestHeader("Prefer", "return=representation");
        userRequest.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status === 201) {
                    debugger
                    var val = JSON.parse(this.responseText).d;
                    _ret = val;
                } else {
                    alert("Error while creating new record. Error - " + userRequest.responseText);
                }
            }
        }
        userRequest.send(jsonEntity);
        return _ret;
    }

    //Call a Workflow
    function CallWorkflow(szWorkflowName, recordId) {
        debugger
        var _url = window.parent.Xrm.Page.context.getClientUrl();
        var _query = "/WorkflowSet?$select=WorkflowId&$filter=Name eq '" + szWorkflowName +
            "' and ActiveWorkflowId/Id ne null";
        var _odataurl = _url + "/XRMServices/2011/OrganizationData.svc" + _query;
        var _uReq = new XMLHttpRequest();
        _uReq.open("GET", _odataurl, false);
        _uReq.setRequestHeader("Accept", "application/json");
        _uReq.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        _uReq.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status === 200) {
                    debugger
                    var _json = JSON.parse(_uReq.responseText);
                    var _res;
                    if ((_json != undefined) && (_json.d != undefined) && (_json.d.results != undefined) && (
                            _json.d.results[0] != null)) {
                        _res = _json.d.results[0];
                        var _wfid = _res.WorkflowId;
                        //test id
                        if (_wfid != null) {
                            //call runworkflow
                            executeWorkflow(_wfid, recordId);
                        } else {
                            alert("Error: Could Not Find Workflow by Name: " + szWorkflowName);
                        }
                    }
                } else {
                    alert("Problem getting Workflow Named: " + szWorkflowName);
                }
            }
        }
        _uReq.send();
    }
    //Execute A Workflow
    function executeWorkflow(szWorkflowID, recordId) {
        var runWorkflow = "executeWorkflow >>";
        var query = "";
        try {
            debugger
            //Define the query to execute the action
            query = "workflows(" + szWorkflowID.replace("}", "").replace("{", "") +
                ")/Microsoft.Dynamics.CRM.ExecuteWorkflow";

            var data = {
                "EntityId": recordId
            };
            //Create request
            // request url
            //https://org.crm.dynamics.com/api/data/v8.2/workflows(“f0ca33cc-23fd-496f-80e1-693873a951ca”)/Microsoft.Dynamics.CRM.ExecuteWorkflow
            var url = window.parent.Xrm.Page.context.getClientUrl();
            var entityId = window.parent.Xrm.Page.data.entity.getId();
            var workflowId = szWorkflowID;
            // var OrgServicePath = "/XRMServices/2011/Organization.svc/web";

            //     url = url + OrgServicePath;
            //     var request;
            var req = new XMLHttpRequest();
            req.open("POST", url + "/api/data/v8.2/" + query, true);
            req.setRequestHeader("Accept", "application/json");
            req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            req.setRequestHeader("OData-MaxVersion", "4.0");
            req.setRequestHeader("OData-Version", "4.0");
            // req.setRequestHeader("http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute", );
            req.onreadystatechange = function () {

                if (this.readyState == 4 /* complete */ ) {
                    req.onreadystatechange = null;

                    if (this.status == 200) {
                        debugger
                        //success callback this returns null since no return value available.
                        var result = JSON.parse(this.response);


                    } else {
                        //error callback
                        var error = JSON.parse(this.response).error;
                    }
                }
            };
            req.send(JSON.stringify(data));

        } catch (e) {
            alert("executeWorkflow: " + e);
        }
    }

    // //Attribute Retrieval 
    // function retrieveAttribute(EntityLogicalName, LogicalName, MetadataId, RetrieveAsIfPublished, successCallBack, errorCallBack, passThroughObject) {
    //     debugger
    //     ///<summary>
    //     /// Sends an asynchronous RetrieveAttribute Request to retrieve a specific entity
    //     ///</summary>
    //     ///<returns>AttributeMetadata</returns>
    //     ///<param name="EntityLogicalName"  optional="true" type="String">
    //     /// The logical name of the entity for the attribute requested. A null value may be used if a MetadataId is provided.
    //     ///</param>
    //     ///<param name="LogicalName" optional="true" type="String">
    //     /// The logical name of the attribute requested. 
    //     ///</param>
    //     ///<param name="MetadataId" optional="true" type="String">
    //     /// A null value may be passed if an EntityLogicalName and LogicalName is provided.
    //     ///</param>
    //     ///<param name="RetrieveAsIfPublished" type="Boolean">
    //     /// Sets whether to retrieve the metadata that has not been published.
    //     ///</param>
    //     ///<param name="successCallBack" type="Function">
    //     /// The function that will be passed through and be called by a successful response.
    //     /// This function must accept the entityMetadata as a parameter.
    //     ///</param>
    //     ///<param name="errorCallBack" type="Function">
    //     /// The function that will be passed through and be called by a failed response.
    //     /// This function must accept an Error object as a parameter.
    //     ///</param>
    //     ///<param name="passThroughObject" optional="true"  type="Object">
    //     /// An Object that will be passed through to as the second parameter to the successCallBack.
    //     ///</param>
    //     if (EntityLogicalName == null && LogicalName == null && MetadataId == null) {
    //      throw new Error("SDK.Metadata.RetrieveAttribute requires either the EntityLogicalName and LogicalName  parameters or the MetadataId parameter not be null.");
    //     }
    //     if (MetadataId != null && EntityLogicalName == null && LogicalName == null) {
    //      if (typeof MetadataId != "string")
    //      { throw new Error("SDK.Metadata.RetrieveEntity MetadataId must be a string value."); }
    //     }
    //     else
    //     { MetadataId = "00000000-0000-0000-0000-000000000000"; }
    //     if (EntityLogicalName != null) {
    //      if (typeof EntityLogicalName != "string") {
    //       { throw new Error("SDK.Metadata.RetrieveAttribute EntityLogicalName must be a string value."); }
    //      }
    //     }
    //     if (LogicalName != null) {
    //      if (typeof LogicalName != "string") {
    //       { throw new Error("SDK.Metadata.RetrieveAttribute LogicalName must be a string value."); }
    //      }

    //     }
    //     if (typeof RetrieveAsIfPublished != "boolean")
    //     { throw new Error("SDK.Metadata.RetrieveAttribute RetrieveAsIfPublished must be a boolean value."); }
    //     if (typeof successCallBack != "function")
    //     { throw new Error("SDK.Metadata.RetrieveAttribute successCallBack must be a function."); }
    //     if (typeof errorCallBack != "function")
    //     { throw new Error("SDK.Metadata.RetrieveAttribute errorCallBack must be a function."); }

    //     var entityLogicalNameValueNode;
    //     if (EntityLogicalName == null) {
    //      entityLogicalNameValueNode = "<b:value i:nil=\"true\" />";
    //     }
    //     else {
    //      entityLogicalNameValueNode = "<b:value i:type=\"c:string\" xmlns:c=\"http://www.w3.org/2001/XMLSchema\">" + _xmlEncode(EntityLogicalName.toLowerCase()) + "</b:value>";
    //     }
    //     var logicalNameValueNode;
    //     if (LogicalName == null) {
    //      logicalNameValueNode = "<b:value i:nil=\"true\" />";
    //     }
    //     else {
    //      logicalNameValueNode = "<b:value i:type=\"c:string\"   xmlns:c=\"http://www.w3.org/2001/XMLSchema\">" + _xmlEncode(LogicalName.toLowerCase()) + "</b:value>";
    //     }
    //     var request = [
    //     "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">",
    //     //Allows retrieval if ImageAttributeMetadata objects
    //     "<soapenv:Header><a:SdkClientVersion xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\">6.0</a:SdkClientVersion></soapenv:Header>",
    //      "<soapenv:Body>",
    //       "<Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">",
    //        "<request i:type=\"a:RetrieveAttributeRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\">",
    //         "<a:Parameters xmlns:b=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">",
    //          "<a:KeyValuePairOfstringanyType>",
    //           "<b:key>EntityLogicalName</b:key>",
    //            entityLogicalNameValueNode,
    //          "</a:KeyValuePairOfstringanyType>",
    //          "<a:KeyValuePairOfstringanyType>",
    //           "<b:key>MetadataId</b:key>",
    //           "<b:value i:type=\"ser:guid\"  xmlns:ser=\"http://schemas.microsoft.com/2003/10/Serialization/\">" + _xmlEncode(MetadataId) + "</b:value>",
    //          "</a:KeyValuePairOfstringanyType>",
    //           "<a:KeyValuePairOfstringanyType>",
    //           "<b:key>RetrieveAsIfPublished</b:key>",
    //         "<b:value i:type=\"c:boolean\" xmlns:c=\"http://www.w3.org/2001/XMLSchema\">" + _xmlEncode(RetrieveAsIfPublished.toString()) + "</b:value>",
    //          "</a:KeyValuePairOfstringanyType>",
    //          "<a:KeyValuePairOfstringanyType>",
    //           "<b:key>LogicalName</b:key>",
    //            logicalNameValueNode,
    //          "</a:KeyValuePairOfstringanyType>",
    //         "</a:Parameters>",
    //         "<a:RequestId i:nil=\"true\" />",
    //         "<a:RequestName>RetrieveAttribute</a:RequestName>",
    //        "</request>",
    //       "</Execute>",
    //      "</soapenv:Body>",
    //     "</soapenv:Envelope>"].join("");
    //     var req = new XMLHttpRequest();
    //     req.open("POST", _getUrl() + "/XRMServices/2011/Organization.svc/web", true);
    //         try { req.responseType = 'msxml-document'} catch(e){}
    //     req.setRequestHeader("Accept", "application/xml, text/xml, */*");
    //     req.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
    //     req.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");
    //     req.onreadystatechange = function () {
    //      if (req.readyState == 4 /* complete */) {
    //      req.onreadystatechange = null; //Addresses potential memory leak issue with IE
    //       if (req.status == 200) {
    //        //Success
    //        var doc = req.responseXML;
    //        try{_setSelectionNamespaces(doc);}catch(e){}
    //        var a = _objectifyNode(_selectSingleNode(doc, "//b:value"));

    //        successCallBack(a, passThroughObject);
    //       }
    //       else {
    //        //Failure
    //        errorCallBack(_getError(req));
    //       }
    //      }
    //     };
    //     req.send(request);


    //    };