// 
const hubspot = require("@hubspot/api-client");
exports.main = async (event, callback) => {
  const hubspotClient = new hubspot.Client({
    accessToken: process.env.CuCo,
  });
  // 1. GET LINE ITMES AND COMPANIES

  // Define constants for api calls
  const dealId = event.inputFields["hs_object_id"];
  const dealName = event.inputFields["dealname"];
  const after = undefined;
  const limit = 500;

  try {
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

    // Get associated companies from deal
    const apiResponse2 = await hubspotClient.crm.deals.basicApi.getById(
      dealId,
      undefined,
      undefined,
      ["companies"]
    );
    const resultsCompanies = apiResponse2.associations.companies.results;

    // Extract the ids of the companies with association label = location
    const locationIds = resultsCompanies
      .filter((item) => item.type === "location")
      .map((item) => item.id);

    // Set variables to retrieve line items properties
    const lineItemId = allIds;
    var properties = ["name", "price", "hs_product_type", "quantity"];
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

    // 2. SET CONSTANTS FOR ORBI CREATION

    // Define the associations for creating the new object
    const associations = [
      {
        to: { id: dealId },
        types: [{ associationCategory: "USER_DEFINED", associationTypeId: 73 }],
      },
    ];

    // Filter the results to include only objects with hs_product_type equal to 'inventory'
    const filteredResults = results.filter(
      (item) => item.data.hs_product_type === "inventory"
    );

    // Specify the correct lineItem for creating the new object
    const newObjectType = "p_orbi_food_waste_monitors";

    // Array to store lineItemIds
    const lineItemIdsArray = [];

    // Check if there is one or more companies for the Orbi
    if (locationIds.length === 1) {
      // Extract the 'id' values from the 'results' array for line items
      const companyId = locationIds[0];

      // Get company name
      const apiResponseGetCompany =
        await hubspotClient.crm.companies.basicApi.getById(companyId, ["name"]);
      const companyName = apiResponseGetCompany.properties.name;

      // Set counter for Orbi name
      let counter = 1;

      // Loop through the output array and create records
      for (const item of filteredResults) {
        const { lineItem, data } = item;
        const { name, quantity, price } = data;
        // Create records as many times as specified by the quantity
        for (let i = 0; i < quantity; i++) {
          // Append the iteration number (starting from 1) to dealName
          const id = dealName + " " + counter;
          const params = {
            id: id,
            client_id: dealName,
            value: price,
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
            73
          );

          counter++;
        }
      }

      // 2. CREATE TICKETS

      // Set properties for ticket
      var properties = {
        subject: "Shipping" + " " + companyName,
        hs_pipeline: "70817678",
        hs_pipeline_stage: "137367173",
        hs_ticket_priority: "HIGH",
        type: "User question",
        hubspot_owner_id: "513921708",
        content: "This is the ticket content",
      };

      const SimplePublicObjectInputForCreate = { properties };

      // Create tickets with set properties
      const ticket = await hubspotClient.crm.tickets.basicApi.create(
        SimplePublicObjectInputForCreate
      );

      // Create associations between orbi's and companyId

      // Loop through the lineItemIdsArray
      for (const ItemId of lineItemIdsArray) {
        // Make the API call for each lineItemId
        await hubspotClient.crm.objects.associationsApi.create(
          "p_orbi_food_waste_monitors",
          [ItemId],
          "companies",
          companyId,
          75
        );
      }
      const ticketId = ticket.properties.hs_object_id;
      // Create associations between ticket and orbi's
      // Loop through the lineItemIdsArray
      for (const ItemId of lineItemIdsArray) {
        // Make the API call for each lineItemId
        await hubspotClient.crm.objects.associationsApi.create(
          "p_orbi_food_waste_monitors",
          [ItemId],
          "tickets",
          ticketId,
          86
        );
      }
      await hubspotClient.crm.objects.associationsApi.create(
        "tickets",
        ticketId,
        "companies",
        companyId,
        26
      );
    } else if (locationIds.length > 1) {
      // Extract the 'id' values from the 'results' array for line items
      const companyIds = locationIds.map((id) => ({ id: id }));

      // Get company name
      const apiResponseGetCompany =
        await hubspotClient.crm.companies.batchApi.read({
          inputs: companyIds,
          properties: ["name"],
        });
      const names = apiResponseGetCompany.results.map(
        (obj) => obj.properties.name
      );

      // Set counter for Orbi name
      let counter = 1;

      // Loop through the output array and create records
      for (const item of filteredResults) {
        const { lineItem, data } = item;
        const { name, quantity, price } = data;
        // Create records as many times as specified by the quantity
        for (let i = 0; i < quantity; i++) {
          // Append the iteration number (starting from 1) to dealName
          const id = dealName + " " + counter;
          const params = {
            id: id,
            client_id: dealName,
            value: price,
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
            73
          );

          counter++;
        }
      }
      // 2. CREATE TICKETS
      const ticketIds = [];
      for (const companyName of names) {
        // Set properties for each ticket, with the current companyName
        var properties = {
          subject: "Shipping" + " " + companyName,
          hs_pipeline: "70817678",
          hs_pipeline_stage: "137367173",
          hs_ticket_priority: "HIGH",
          type: "User question",
          hubspot_owner_id: "513921708",
          content: "This is the ticket content",
        };

        const SimplePublicObjectInputForCreate = { properties };

        // Create tickets with set properties for each company
        const ticket = await hubspotClient.crm.tickets.basicApi.create(
          SimplePublicObjectInputForCreate
        );
        ticketIds.push(ticket.properties.hs_object_id);
        await hubspotClient.crm.objects.associationsApi.create(
          "tickets",
          ticket.properties.hs_object_id,
          "deals",
          dealId,
          28
        );
      }
    }
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};
