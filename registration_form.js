const hubspot = require('@hubspot/api-client');

exports.main = async (event, callback) => {
    const contactId = event.inputFields['contact_id'];
    const dealId = event.inputFields['deal_id'];
    const emailAddressOfTheShipmentContact = event.inputFields['email_address_of_the_shipment_contact'];
  var serviceCode = ''
  if( typeof event.inputFields['external_customer_id'] === 'undefined' || null){
      serviceCode = ''
    }else{
      serviceCode = event.inputFields['external_customer_id']
    }
    
  	if (!dealId) {
      return;
    }

    const hubspotClient = new hubspot.Client({
        accessToken: process.env.CuCo
    });

    // associate contact with deal
    await hubspotClient.crm.objects.associationsApi.create(
        'deals',
        dealId,
        'contacts',
        contactId,
        'main_contact'
    );

    if (emailAddressOfTheShipmentContact) {
        // find contact(s) with email = contact.emailAddressOfTheShipmentContact
        const filters = [{
            propertyName: 'email',
            operator: 'EQ',
            value: emailAddressOfTheShipmentContact
        }];

        const filterGroups = [{
            filters
        }];

        const shipmentContacts = await hubspotClient.crm.contacts.searchApi.doSearch({
            filterGroups,
            sorts: ['email'],
            after: 0,
            limit: 100,
            properties: ['email']
        });

        for (let i = 0; i < shipmentContacts.results.length; i++) {
            // associate shipment contact(s) with deal
            await hubspotClient.crm.objects.associationsApi.create(
                'deals',
                dealId,
                'contacts',
                shipmentContacts.results[i].id,
                'main_logistic_contact'
            );
        }
    }

    // update deal properties 
    await hubspotClient.crm.deals.basicApi.update(dealId, {
        properties: {
            invoice_company_name: event.inputFields['invoice_company_name'],
            invoice_contact_person: event.inputFields['invoice_contact_person'],
            invoicing_street_address: event.inputFields['invoice_address'],
            vat___taxid___siret: event.inputFields['vat_number'],
            invoice_po_box: event.inputFields['invoice_po_box'],
            invoicing_postal_code: event.inputFields['invoice_postal_code'],
            invoicing_city: event.inputFields['invoice_city'],
            invoicing_country: event.inputFields['invoice_country'],
            invoice_reference___comment___po_number: event.inputFields['invoice_reference___comment___po_number'],
            invoice_e_mail: event.inputFields['invoice_email_address'],
            connection: event.inputFields['internet'],
            devices_at_location: event.inputFields['devices_at_location'],
            sharing_on_social_media: event.inputFields['sharing_on_social_media'],
            service_code: event.inputFields['external_customer_id'],//serviceCode,
            dealstage: '159432843',
            consignee__first___last_name_: event.inputFields['consignee__first___last_name_'],
            logistics_street_address: event.inputFields['address'],
            logistics_postal_code: event.inputFields['zip'],
            logistics_city: event.inputFields['city'],
            logistics_state_region: event.inputFields['state'],
            logistics_country: event.inputFields['country_for_orbisk'],
        }
    });

    // find company associated to deal
    const deal = await hubspotClient.crm.deals.basicApi.getById(
        dealId,
        undefined,
        undefined,
        ['companies']
    );
      const companyLocation = deal.associations.companies.results
            .filter(item => item.type === 'location')
            .map(item => item.id);
 
  for (let i = 0; i < companyLocation.length; i++) {
        // update company properties 
        await hubspotClient.crm.companies.basicApi.update(companyLocation[i], {
            properties: {
                sharing_on_social_media: event.inputFields['sharing_on_social_media'],
            }
        });
    }
}