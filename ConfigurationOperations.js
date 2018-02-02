// =====================================================================
//  This file is part of the Microsoft Dynamics CRM SDK code samples.
//
//  Copyright (C) Microsoft Corporation.  All rights reserved.
//
//  This source code is intended only as a supplement to Microsoft
//  Development Tools and/or on-line documentation.  See these other
//  materials for detailed information regarding Microsoft code samples.
//
//  THIS CODE AND INFORMATION ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY
//  KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
//  IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A
//  PARTICULAR PURPOSE.
// =====================================================================

/// <reference path="SDK.REST.js" />

//<snippetJavaScriptRESTDataOperationsSampleJS>
var configExists = false;
var startButton;
var resetButton;
var output; //The <ol> element used by the writeMessage function to display text showing the progress of this sample.
var configLabel;

document.onreadystatechange = function () {
    switch (document.readyState) {
        case "loading":
            // The document is still loading
            
            break;
        case "interactive":
            // The document has finished loading. We can now access the DOM elements.
            //var span = document.createElement("span");
            //span.textContent = "A <span> element.";
            //document.body.appendChild(span);
            debugger;
            configLabel = document.getElementById("configLabel");
            configLabel.innerText = "Found";
            configLabel.className = "badge badge-success btn-sm";
        case "complete":

        //Call functions for Getting Entities (Licence, 2BLaw Version, Legal Record Configuration )
            // The page is fully loaded.
            debugger;
            getConfigurationRecordExists();
            startButton = document.getElementById("configInstall");
            resetButton = document.getElementById("reset");
            output = document.getElementById("output");
            startButton.onclick = createAccount;
            console.log("The first CSS rule is: " + document.styleSheets[0].cssRules[0].cssText);
            break;
    }
}

window.onload = function () {
    debugger;
    //alert(configExists);
}

//functions/

function createAccount() {
    debugger;
    if (configExists) {
        return;
    }

    var account = {};
    account.bbs_name = "Primary";

    //Set a picklist value
    writeMessage("Setting Billing Unit Minimum.");
    account.bbs_BillingUnitMin = { Value: 100000001 }; //10 minute increments

    //Create the Account
    SDK.REST.createRecord(
        account,
        "bbs_legalconfiguration",
        function (account) {
            writeMessage("The configuration named \"" + account.bbs_name + "\" was created with the Id : \"" + account.bbs_legalconfigurationId + "\".");
            writeMessage("Retrieving configuration with the Id: \"" + account.bbs_legalconfigurationId + "\".");
            retrieveAccount(account.bbs_legalconfigurationId);
        },
        errorHandler
      );
    this.setAttribute("disabled", "disabled");
}

 function retrieveAccount(bbs_legalconfigurationId) {
 SDK.REST.retrieveRecord(
     bbs_legalconfigurationId,
     "bbs_legalconfiguration",
     null,null,
     function (account) {
      writeMessage("Retrieved the configuration named \"" + account.bbs_name + "\". This configuration was created on : \"" + account.CreatedOn + "\".");
      //updateAccount(AccountId);
     },
     errorHandler
   );
}

 function updateAccount(bbs_legalconfigurationId) {
 var account = {};
 writeMessage("Changing the account Name to \"Updated Account Name\".");
 account.Name = "Updated Account Name";
 writeMessage("Adding Address information");
 account.Address1_AddressTypeCode = { Value: 3 }; //Address 1: Address Type = Primary
 account.Address1_City = "Sammamish";
 account.Address1_Line1 = "123 Maple St.";
 account.Address1_PostalCode = "98074";
 account.Address1_StateOrProvince = "WA";
 writeMessage("Setting E-Mail address");
 account.EMailAddress1 = "someone@microsoft.com";


 SDK.REST.updateRecord(
     AccountId,
     account,
     "Account",
     function () {
      writeMessage("The account record changes were saved");
      deleteAccount(AccountId);
     },
     errorHandler
   );
}

function deleteAccount(AccountId) {
 if (confirm("Do you want to delete this account record?")) {
  writeMessage("You chose to delete the account record.");
  SDK.REST.deleteRecord(
       AccountId,
       "Account",
       function () {
        writeMessage("The account was deleted.");
        enableResetButton();
       },
       errorHandler
     );
 }
 else {
  var li = document.createElement("li");

  var span = document.createElement("span");

  setElementText(span, "You chose not to delete the record. You can view the record ");
		

  var link = document.createElement("a");
  link.href = SDK.REST._getClientUrl() + "/main.aspx?etc=1&id=%7b" + AccountId + "%7d&pagetype=entityrecord";
  link.target = "_blank";
  setElementText(link, "here");


  li.appendChild(span);
  li.appendChild(link);
  output.appendChild(li);
  enableResetButton();

 }
}

function getConfigurationRecordExists() {

 SDK.REST.retrieveMultipleRecords(
     "bbs_legalconfiguration",
     "$filter=bbs_name eq 'Primary'",
     function (results) {
      var firstResult = results[0];
      if (firstResult != null) {
          configExists = true;
      }
      else {
       writeMessage("No Legal Configuration records exist.");
      }
     },
     errorHandler,
     function () { 
     //OnComplete handler
      }
   );
}

function errorHandler(error) {
 writeMessage(error.message);
}

function enableResetButton() {
 resetButton.removeAttribute("disabled");
}

function resetSample() {
 output.innerHTML = "";
 startButton.removeAttribute("disabled");
 resetButton.setAttribute("disabled", "disabled");
}

//Helper function to write data to this page:
function writeMessage(message) {
	var li = document.createElement("li");

	setElementText(li, message);


 output.appendChild(li);
}
//Because Firefox doesn't  support innerText
function setElementText(element, text)
{
	if (element.innerText != undefined)
	{
		element.innerText = text;
	}
	else
	{
		element.textContent = text;
	}
}

//</snippetJavaScriptRESTDataOperationsSampleJS>