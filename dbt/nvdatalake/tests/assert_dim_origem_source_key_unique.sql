select source_key
from {{ ref('dim_origem') }}
group by source_key
having count(*) > 1
