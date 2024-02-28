const hubspot = require("@hubspot/api-client");
exports.main = async (event, callback) => {
  const hubspotClient = new hubspot.Client({
    accessToken: process.env.CuCo,
  });
  
     // STAP 1. INFO OPHALEN: GET ASSOCIATED LINE ITMES AND COMPANIES FROM DEAL

  // Define constants for api calls
  const dealId = event.inputFields["hs_object_id"];
  const dealName = event.inputFields["dealname"];
  const after = undefined;
  const limit = 500;
  const connection = event.inputFields["connection"];
  const email = event.inputFields["main_logistic_contact__email_"]
  const phone = event.inputFields["main_logistic_contact__phone_"]
  const name = event.inputFields["main_logistic_contact__name_"]
  const lastName = event.inputFields["main_logistic_contact__last_name_"]
  const city = event.inputFields["logistics_city"]
  const country = event.inputFields["logistics_country"]
  const postalCode = event.inputFields["logistics_postal_code"]
  const stateRegion = event.inputFields["logistics_state_region"]
  const streetAddress = event.inputFields["logistics_street_address"]
  const consignee = event.inputFields["consignee__first___last_name_"]
  try {
    // LINE ITEMS
    // Get line items from deal
    const apiResponse = await hubspotClient.crm.objects.associationsApi.getAll(
      "deals",
      dealId,
      "line_items",
      after,
      limit
    );

    // Extract the 'id' values from the 'results' array for line items
    const allIds = apiResponse.results.map((item) => item.id);
    // Set variables to retrieve line items properties
    const lineItemId = allIds;
    var properties = ["name", "price", "hs_product_type", "quantity","software_type","hardware_type","recurringbillingfrequency","hs_recurring_billing_period"];
    const results = [];
    // Loop through line items and retrieve properties
    for (const lineItem of lineItemId) {
      const apiResponseLineItems =
        await hubspotClient.crm.lineItems.basicApi.getById(
          [lineItem],
          properties
        );
      results.push({
        lineItem: lineItem,
        data: apiResponseLineItems.properties,
      });
    }
    
    // COMPANIES
    // Get associated companies from deal
    const apiResponse2 = await hubspotClient.crm.deals.basicApi.getById(
      dealId,
      undefined,
      undefined,
      ["companies"]
    );
    
      const resultsCompanies = apiResponse2.associations.companies.results;

    // Extract the ids of the companies with does not have association label = Headquarters
    const locationIdss = resultsCompanies
      .filter((item) => item.type !== "Headquarters")
      .map((item) => item.id);
    
    const locationIds = [...new Set(locationIdss)]
	
    // CONTACTS
    // Get associated contacts from deal
    const apiResponseContacts = await hubspotClient.crm.deals.basicApi.getById(
      dealId,
      undefined,
      undefined,
      ["contacts"]
    );
    
  const contacts = apiResponseContacts.associations.contacts.results
  const mainLogisticContacts = contacts
    .filter(item => item.type === 'main_logistic_contact')
    .map(item => item.id);
           
    // STAP 2. ORBI's MAKEN: SET CONSTANTS FOR ORBI CREATION

    // Define the associations for creating the new object
    const associations = [
      {
        to: { id: dealId },
        types: [{ associationCategory: "USER_DEFINED", associationTypeId: 103 }],
      },
    ];
    // Filter the results to include only objects with hs_product_type equal to 'inventory'
    const filteredResults = results.filter(
      (item) => item.data.hs_product_type === "inventory"
    );
    

    // Specify the object type to create
    const newObjectType = "p_orbi_food_waste_monitors";

    // Array to store lineItemIds
    const lineItemIdsArray = [];

   
      // Extract the 'id' values from the 'results' array for line items
      const companyIds = locationIds.map((id) => ({ id: id }));

      // Get company name
      const apiResponseGetCompany =
        await hubspotClient.crm.companies.batchApi.read({
          inputs: companyIds,
          properties: ["name"],
        });
      const ids = apiResponseGetCompany.results.map(
      	(obj) => obj.properties.hs_object_id
      );
      const names = apiResponseGetCompany.results.map(
        (obj) => obj.properties.name
      );

      // Set counter for Orbi name
      let counter = 1;
    
// Loop through the output array and create records
for (const item of filteredResults) {
  const { lineItem, data } = item;
  const { name, quantity, price, software_type, hardware_type } = data;

  // Calculate MRR based on the conditions
  let MRR = 0;
  if (data.recurringbillingfrequency === 'annually') {
    const recurringBillingPeriod = data.hs_recurring_billing_period;
    if (recurringBillingPeriod) {
      const matches = recurringBillingPeriod.match(/P(\d+)M/);
      if (matches) {
        const numberOfMonths = parseInt(matches[1], 10);
        MRR = price / numberOfMonths;
      }
    }
  } else if (data.recurringbillingfrequency === 'monthly') {
    MRR = price;
  }

  // Create records as many times as specified by the quantity
  for (let i = 0; i < quantity; i++) {
    // Append the iteration number (starting from 1) to dealName
    const id = dealName + " " + counter;
    const params = {
      id: id,
      client_id: dealName,
      value: MRR,
      device_inactive: 'false',
      connection: connection,
      software_type: software_type,
      hardware_type: hardware_type
    };

          // Construct the input for creating the new object
          const SimplePublicObjectInputForCreate = {
            associations,
            properties: params,
          };

          // Create the new object
          const response = await hubspotClient.crm.objects.basicApi.create(
            newObjectType,
            SimplePublicObjectInputForCreate
          );

          // Push the hs_object_id from the response body to the array
          lineItemIdsArray.push(response.properties.hs_object_id);
          
    // Create association between created orbi and deal
          await hubspotClient.crm.objects.associationsApi.create(
            "p_orbi_food_waste_monitors",
            response.properties.hs_object_id,
            "deals",
            dealId,
            103
          );

          counter++;
        }
      }

      // STAP 4. CREATE TICKETS
      // Set properties for each ticket, with the current companyName
        var properties = {
          subject: "Shipping" + " " + dealName,
          hs_pipeline: "69967232",
          hs_pipeline_stage: "135627918",
          hs_ticket_priority: "HIGH",
          type: "Shipping",
          connection: connection,
          main_logistic_contact__email_: email,
          main_logistic_contact__name_:name,
          main_logistic_contact__phone_: phone,
          main_logistics_contact__last_name_: lastName,
          logistics_postal_code: postalCode,
          logistics_street_address: streetAddress,
          logistics_state_region: stateRegion,
          logistics_city: city,
          logistics_country: country,
          content: "This is the ticket content",
          consignee__first___last_name_: consignee,
        };

        const SimplePublicObjectInputForCreate = { properties };

        // Create tickets with set properties for each company
        const ticket = await hubspotClient.crm.tickets.basicApi.create(
          SimplePublicObjectInputForCreate
        );
        const ticketId = ticket.properties.hs_object_id;
 
        if (mainLogisticContacts.length === 1) {
        await hubspotClient.crm.objects.associationsApi.create(
        "tickets",
        ticket.properties.hs_object_id,
        "contacts",
           mainLogisticContacts[0],
           "main_logistics_contact"
           );
        }
        if (mainLogisticContacts.length === 2){
          await hubspotClient.crm.objects.associationsApi.create(
        "tickets",
        ticket.properties.hs_object_id,
        "contacts",
          mainLogisticContacts[1],
            'main_logistics_contact'
        )
        }
    
            await hubspotClient.crm.objects.associationsApi.create(
          "tickets",
          ticketId,
          "deals",
          dealId,
          28
        );
    
          // Create associations between ticket and orbi's
      // Loop through the lineItemIdsArray
      for (const ItemId of lineItemIdsArray) {
        // Make the API call for each lineItemId
        await hubspotClient.crm.objects.associationsApi.create(
          "p_orbi_food_waste_monitors",
          [ItemId],
          "tickets",
          ticketId,
          110
        );
      }

      for (const id of locationIds) {


        await hubspotClient.crm.objects.associationsApi.create(
        "tickets",
        ticketId,
        "companies",
        [id],
        339
      );

      // Loop through the lineItemIdsArray
      for (const ItemId of lineItemIdsArray) {
        // Make the API call for each lineItemId
        await hubspotClient.crm.objects.associationsApi.create(
          "p_orbi_food_waste_monitors",
          [ItemId],
          "companies",
          [id],
          101
        );
      }    
    }

  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};